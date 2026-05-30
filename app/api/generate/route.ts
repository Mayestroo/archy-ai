// app/api/generate/route.ts
import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { validateAndFixFloorPlan } from "@/lib/validateFloorPlan";
import { generateLayout, listPixelTemplates, type AIResponse } from "@/lib/layout-engine";
import type { FloorPlan } from "@/lib/floorplan-schema";

// ── Request / Response shapes ─────────────────────────────────────────────────

interface GenerateRequest {
  prompt: string;
  currentFloorPlan?: FloorPlan; // For "Smart Layout" refinement
}

interface GenerateResponse {
  floorPlan: FloorPlan;
  enhancedPrompt: string;
}

interface ErrorResponse {
  error: string;
}

interface GenerateApiError {
  message?: string;
  status?: number;
  errorDetails?: { retryDelay?: string }[];
}

function toGenerateApiError(err: unknown): GenerateApiError {
  if (err instanceof Error) {
    return err as Error & GenerateApiError;
  }
  if (typeof err === "object" && err !== null) {
    return err as GenerateApiError;
  }
  return { message: String(err) };
}

function getErrorMessage(err: unknown): string {
  return toGenerateApiError(err).message ?? "Unknown error";
}

// ── System Prompt (new two-stage approach) ────────────────────────────────────
// The AI ONLY returns room dimensions + zones. The layout engine assigns x/y.

function buildSystemPrompt(availableTemplates: string): string {
  return `
You are an architectural design assistant.
Your ONLY job is to pick the best template and provide human-readable room labels.
All pixel positions are FIXED and HARDCODED — you must NOT change them.

AVAILABLE TEMPLATES (pick the best match for the user's request):
${availableTemplates}

Return ONLY valid JSON matching this EXACT schema — nothing else:
{
  "template": "<template_key>",
  "totalArea": <number, sqm — use the template's listed area>,
  "rooms": [
    {
      "id": "<unique_snake_case_id>",
      "type": "living|dining|kitchen|bedroom|master_bedroom|bathroom|ensuite|hallway|laundry|entry|garage|studio",
      "label": "<Human Readable Name, e.g. Master Bedroom, Kitchen>",
      "hasWindow": <boolean>,
      "hasDoor": <boolean>
    }
  ]
}

RULES:
1. Pick the template whose bedroom count and area best matches the user's request.
2. Include ONE room object per room that exists in the template (follow the template's room list).
3. The "type" field MUST exactly match the slot types in the chosen template.
4. For templates with multiple bedrooms, include a "bedroom" entry for each one.
5. Every bedroom / living room / studio MUST have hasWindow: true.
6. Every room MUST have hasDoor: true.
7. Do NOT add extra rooms beyond what the template defines.
8. Do NOT include x, y, width, height, area, aspectRatio, or zone fields.
`.trim();
}

// ── Refinement Prompt ────────────────────────────────────────────────────────
// Used when the user is modifying an EXISTING plan. The AI must respect the
// current layout as a baseline and only change what the user asked for.

function buildRefinementPrompt(
  currentFloorPlan: FloorPlan,
  newRequest: string,
  availableTemplates: string
): string {
  const currentRooms = currentFloorPlan.rooms
    .map(r => {
      const hasWindow = currentFloorPlan.windows.some(w => w.roomId === r.id);
      const hasDoor = currentFloorPlan.doors.some(d => d.roomId === r.id);
      return `  - id: "${r.id}" | type: "${r.type}" | label: "${r.label}" | hasWindow: ${hasWindow} | hasDoor: ${hasDoor}`;
    })
    .join("\n");

  const templateKey =
    "template" in currentFloorPlan && typeof currentFloorPlan.template === "string"
      ? currentFloorPlan.template
      : "unknown";

  return `
You are an architectural design assistant refining an EXISTING floor plan.
Your job is to apply the user's requested change while keeping everything else identical.

CURRENT FLOOR PLAN (template: "${templateKey}", area: ${currentFloorPlan.totalArea} sqm):
ROOMS:
${currentRooms}

AVAILABLE TEMPLATES (only switch template if the change REQUIRES a different room count or area):
${availableTemplates}

USER CHANGE REQUEST: "${newRequest}"

Return ONLY valid JSON matching this EXACT schema — nothing else:
{
  "template": "<keep existing template key, or change ONLY if room count/area must change>",
  "totalArea": <number, sqm>,
  "rooms": [
    {
      "id": "<reuse existing id for unchanged rooms, new snake_case id for new rooms>",
      "type": "living|dining|kitchen|bedroom|master_bedroom|bathroom|ensuite|hallway|laundry|entry|garage|studio",
      "label": "<Human Readable Name>",
      "hasWindow": <boolean>,
      "hasDoor": <boolean>
    }
  ]
}

RULES:
1. PRESERVE all rooms that are NOT mentioned in the change request — reuse their exact id, type, label, hasWindow, hasDoor.
2. Only modify the specific room(s) the user asked to change.
3. If the user asks to ADD a room and the template has a slot for it, add it. If not, switch to the nearest larger template.
4. If the user asks to REMOVE a room, omit it and switch to the nearest smaller template if needed.
5. Relabelling (e.g. "rename bedroom to office") should change label and type only — keep the same id.
6. Every bedroom / living room / studio MUST have hasWindow: true.
7. Every room MUST have hasDoor: true.
8. Do NOT include x, y, width, height, area, aspectRatio, or zone fields.
`.trim();
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest
): Promise<NextResponse<GenerateResponse | ErrorResponse>> {
  // 1. Parse and validate request body
  let body: GenerateRequest;
  try {
    body = (await req.json()) as GenerateRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { prompt, currentFloorPlan } = body;
  if (!prompt) {
    return NextResponse.json({ error: "No prompt provided." }, { status: 400 });
  }

  // 2. Validate API key and build client
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("Generate API Error: GEMINI_API_KEY is missing from environment variables.");
    return NextResponse.json({ error: "API key not found." }, { status: 500 });
  }

  // Log masked key for debugging (first 4 and last 4 chars)
  const maskedKey = `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
  console.log(`[Generate API] Using API Key: ${maskedKey}`);

  const genAI = new GoogleGenerativeAI(apiKey);
  
  // Try models in order of preference. 
  // Verified aliases from REST API: gemini-flash-latest, gemini-pro-latest, gemini-2.0-flash, gemini-2.0-flash-lite
  const modelsToTry = ["gemini-2.0-flash", "gemini-flash-latest", "gemini-pro-latest", "gemini-2.0-flash-lite"];
  let lastError: GenerateApiError | null = null;

  for (const modelName of modelsToTry) {
    try {
      console.log(`[Generate API] Attempting generation with model: ${modelName}`);
      const model = genAI.getGenerativeModel({ 
        model: modelName,
        generationConfig: { responseMimeType: "application/json" }
      });

      // 3. Build system prompt with available templates
      const templates = listPixelTemplates()
        .map(t => `  - "${t.key}": ${t.description} (~${t.totalArea} sqm)`)
        .join("\n");
      const systemPrompt = buildSystemPrompt(templates);

      // For refinements, use a dedicated prompt that preserves unchanged rooms.
      // For fresh generation, use the standard system prompt.
      const finalPrompt = currentFloorPlan
        ? buildRefinementPrompt(currentFloorPlan, prompt, templates)
        : `${systemPrompt}\n\nUSER REQUEST: ${prompt}`;

      const result = await model.generateContent(finalPrompt);
      const response = await result.response;
      const text = response.text();

      // 4. Parse AI response (rooms are dimension-only, no x/y)
      const aiResponse = JSON.parse(text) as AIResponse;

      // 5. Two-stage pipeline: pack rooms into zones → assign x/y positions
      let floorPlan: FloorPlan;
      try {
        floorPlan = generateLayout(aiResponse);
      } catch (layoutErr: unknown) {
        console.error(`[Generate API] Layout engine failed: ${getErrorMessage(layoutErr)}. Falling back to AI coordinates.`);
        // Fallback: if AI erroneously included x/y, pass through directly
        floorPlan = aiResponse as unknown as FloorPlan;
      }

      // 6. Validate and fix geometry (gaps/overlaps)
      const cleanedFloorPlan = validateAndFixFloorPlan(floorPlan);

      console.log(`[Generate API] Successfully generated floor plan using ${modelName}`);
      return NextResponse.json({
        floorPlan: cleanedFloorPlan,
        enhancedPrompt: prompt,
      });

    } catch (err: unknown) {
      const apiError = toGenerateApiError(err);
      lastError = apiError;
      const statusCode = apiError.status || 0;
      const message = apiError.message ?? "";
      const isQuotaError = statusCode === 429 || message.includes("429") || message.includes("quota") || message.includes("limit");
      const isNotFoundError = statusCode === 404 || message.includes("404") || message.includes("not found");
      const isAuthError = statusCode === 403 || message.includes("403") || message.includes("permission");
      
      console.error(`[Generate API] Error with model ${modelName}:`, message || "Unknown error");

      // Fallback if it's a quota, not found (sometimes models are removed or renamed), or auth error
      if ((isQuotaError || isNotFoundError || isAuthError) && modelName !== modelsToTry[modelsToTry.length - 1]) {
        console.warn(`[Generate API] ${modelName} failed with ${statusCode}. Falling back to next model...`);
        continue; 
      }
      
      break; 
    }
  }

  // If we exhausted all models or hit a non-quota error
  const isQuotaError = lastError?.status === 429 || lastError?.message?.includes("429") || lastError?.message?.includes("quota") || lastError?.message?.includes("limit");

  if (isQuotaError) {
    return NextResponse.json(
      { error: `API Limit Reached (429). The provided API key might have a zero quota or has hit its limit. Please check your Google AI Studio billing/plan. (Error: ${lastError?.message ?? "Unknown error"})` }, 
      { status: 429 }
    );
  }

  return NextResponse.json({ error: lastError?.message || "Failed to generate floor plan." }, { status: 500 });
}
