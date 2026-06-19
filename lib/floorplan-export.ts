import type { Door, FloorPlan, FurnitureItem, FurnitureType, Room, WallSide, Window as FloorPlanWindow } from "./floorplan-schema";
import { ensureFurniture } from "./furniture";
import { ensureMaterials, getRoomMaterial } from "./materials";
import {
  CANVAS_UNITS_PER_METER,
  getDoorHinge,
  getDoorSwing,
  getOpeningWidthMeters,
} from "./openings";

export type FloorPlanExportTemplate = "presentation" | "technical" | "real_estate";
export type FloorPlanExportQuality = "standard" | "high" | "print";

interface ExportMetadata {
  title?: string;
  template?: FloorPlanExportTemplate;
  quality?: FloorPlanExportQuality;
}

interface PlanBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

const PALETTE = [
  "#5D5DFF",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#06b6d4",
  "#8b5cf6",
  "#ec4899",
  "#84cc16",
  "#f97316",
  "#14b8a6",
];

export const FLOOR_PLAN_EXPORT_TEMPLATES: Array<{ value: FloorPlanExportTemplate; label: string; description: string }> = [
  { value: "presentation", label: "Presentation", description: "Branded concept plan for client review." },
  { value: "technical", label: "Technical", description: "Cleaner drawing set with measurement emphasis." },
  { value: "real_estate", label: "Real Estate", description: "Listing-friendly summary for buyers and builders." },
];

export const FLOOR_PLAN_EXPORT_QUALITIES: Array<{ value: FloorPlanExportQuality; label: string; description: string }> = [
  { value: "standard", label: "Standard", description: "Fast client preview export." },
  { value: "high", label: "High Resolution", description: "Larger PNG output for presentation screens." },
  { value: "print", label: "Print", description: "Print-ready PNG and larger PDF sheet." },
];

export async function exportFloorPlanPDF(floorPlan: FloorPlan, metadata: ExportMetadata = {}) {
  const exportPlan = ensureFurniture(ensureMaterials(floorPlan));
  const { jsPDF } = await import("jspdf");
  const exportTemplate = getExportTemplate(metadata.template);
  const exportQuality = getExportQuality(metadata.quality);
  const qualityConfig = getQualityConfig(exportQuality);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: qualityConfig.pdfFormat });
  const templateConfig = getTemplateConfig(exportTemplate);
  const pageW = qualityConfig.pdfPageW;
  const pageH = qualityConfig.pdfPageH;
  const margin = 12;
  const titleH = 22;
  const rightPanelW = 70;
  const footerH = 8;
  const planX = margin;
  const planY = margin + titleH;
  const planW = pageW - margin * 3 - rightPanelW;
  const planH = pageH - margin * 2 - titleH - footerH;
  const panelX = planX + planW + margin;
  const bounds = getPlanBounds(exportPlan.rooms);
  const scale = Math.min(planW / bounds.width, planH / bounds.height);
  const offX = planX + (planW - bounds.width * scale) / 2;
  const offY = planY + (planH - bounds.height * scale) / 2;
  const title = metadata.title?.trim() || "Archy AI Floor Plan";
  const date = new Date().toLocaleDateString();
  const stats = getPlanStats(exportPlan);

  doc.setFillColor(templateConfig.header.r, templateConfig.header.g, templateConfig.header.b);
  doc.rect(0, 0, pageW, margin + titleH - 5, "F");
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(17);
  doc.text(title.slice(0, 72), margin, margin + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`${templateConfig.eyebrow} · ${qualityConfig.label} · Generated ${date} · Archy AI`, margin, margin + 11);
  doc.text(`${templateConfig.headerRight} · Scale: 1 grid square = 1m`, pageW - margin, margin + 11, { align: "right" });

  drawPdfPlan(doc, exportPlan, bounds, scale, offX, offY, exportTemplate);
  drawPdfPanel(doc, exportPlan, stats, panelX, planY, rightPanelW, exportTemplate, exportQuality);

  doc.setDrawColor(180);
  doc.setLineWidth(0.2);
  doc.line(margin, pageH - margin, pageW - margin, pageH - margin);
  doc.setFontSize(7);
  doc.setTextColor(90, 90, 90);
  doc.text(templateConfig.disclaimer, margin, pageH - 6);
  doc.text(`Rooms: ${exportPlan.rooms.length} · Doors: ${exportPlan.doors?.length ?? 0} · Windows: ${exportPlan.windows?.length ?? 0}`, pageW - margin, pageH - 6, { align: "right" });

  doc.save(`archy-floor-plan-${exportQuality}-${Date.now()}.pdf`);
}

export function exportFloorPlanPNG(floorPlan: FloorPlan, metadata: ExportMetadata = {}) {
  const exportPlan = ensureFurniture(ensureMaterials(floorPlan));
  const exportTemplate = getExportTemplate(metadata.template);
  const exportQuality = getExportQuality(metadata.quality);
  const qualityConfig = getQualityConfig(exportQuality);
  const canvas = document.createElement("canvas");
  canvas.width = qualityConfig.pngWidth;
  canvas.height = qualityConfig.pngHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("PNG export is not supported in this browser.");

  const scale = qualityConfig.pngWidth / 1800;
  ctx.scale(scale, scale);
  drawPngExport(ctx, exportPlan, metadata, 1800, 1200, exportTemplate, exportQuality);

  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = `archy-floor-plan-${exportQuality}-${Date.now()}.png`;
  link.click();
}

function drawPdfPlan(
  doc: import("jspdf").jsPDF,
  floorPlan: FloorPlan,
  bounds: PlanBounds,
  scale: number,
  offX: number,
  offY: number,
  exportTemplate: FloorPlanExportTemplate,
) {
  const technical = exportTemplate === "technical";
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.35);
  doc.rect(offX - 3, offY - 3, bounds.width * scale + 6, bounds.height * scale + 6, "FD");
  drawPdfGrid(doc, bounds, scale, offX, offY);

  floorPlan.rooms.forEach((room, index) => {
    const rect = mapRoom(room, bounds, scale, offX, offY);
    const material = getRoomMaterial(floorPlan, room.id);
    const rgb = technical ? { r: 17, g: 24, b: 39 } : hexToRgb(material?.floorColor ?? PALETTE[index % PALETTE.length]);
    const strokeRgb = hexToRgb(technical ? "#111827" : material?.accentColor ?? "#111827");
    doc.setFillColor(rgb.r, rgb.g, rgb.b);
    doc.setDrawColor(strokeRgb.r, strokeRgb.g, strokeRgb.b);
    doc.setLineWidth(0.45);
    doc.setGState(doc.GState({ opacity: technical ? 0.06 : material ? 0.38 : 0.16 }));
    doc.rect(rect.x, rect.y, rect.w, rect.h, "F");
    doc.setGState(doc.GState({ opacity: 1 }));
    doc.rect(rect.x, rect.y, rect.w, rect.h, "S");
    drawPdfFurniture(doc, rect, roomFurniture(floorPlan, room.id), scale, technical);
    doc.setTextColor(17, 24, 39);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(Math.max(5.5, Math.min(8, rect.w / 8)));
    doc.text(room.label, rect.x + rect.w / 2, rect.y + rect.h / 2 - 1, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.5);
    doc.text(`${roomArea(room)} m²`, rect.x + rect.w / 2, rect.y + rect.h / 2 + 4, { align: "center" });
    drawPdfRoomDimensions(doc, rect, room);
  });

  floorPlan.doors?.forEach((door) => drawPdfDoor(doc, floorPlan.rooms, door, bounds, scale, offX, offY));
  floorPlan.windows?.forEach((window) => drawPdfWindow(doc, floorPlan.rooms, window, bounds, scale, offX, offY));
  drawPdfScaleBar(doc, offX + 4, offY + bounds.height * scale - 5, bounds, scale);
}

function drawPdfPanel(
  doc: import("jspdf").jsPDF,
  floorPlan: FloorPlan,
  stats: ReturnType<typeof getPlanStats>,
  x: number,
  y: number,
  w: number,
  exportTemplate: FloorPlanExportTemplate,
  exportQuality: FloorPlanExportQuality,
) {
  const templateConfig = getTemplateConfig(exportTemplate);
  const qualityConfig = getQualityConfig(exportQuality);
  doc.setFillColor(249, 250, 251);
  doc.setDrawColor(209, 213, 219);
  doc.roundedRect(x, y, w, 154, 2, 2, "FD");
  doc.setTextColor(17, 24, 39);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(templateConfig.panelTitle, x + 4, y + 8);

  const metrics = [
    ["Total area", `${floorPlan.totalArea || stats.area} m²`],
    ["Rooms", `${floorPlan.rooms.length}`],
    ["Bedrooms", `${stats.beds}`],
    ["Bathrooms", `${stats.baths}`],
    ["Doors", `${floorPlan.doors?.length ?? 0}`],
    ["Windows", `${floorPlan.windows?.length ?? 0}`],
    ["Furniture", `${floorPlan.furniture?.length ?? 0}`],
    ["Concepts", `${(floorPlan.interiorConcepts?.length ?? 0) + (floorPlan.exteriorConcept ? 1 : 0)}`],
    ["Quality", qualityConfig.label],
  ];
  let cy = y + 17;
  doc.setFontSize(7.5);
  for (const [label, value] of metrics) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(107, 114, 128);
    doc.text(label, x + 4, cy);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(17, 24, 39);
    doc.text(value, x + w - 4, cy, { align: "right" });
    cy += 6;
  }

  cy += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(templateConfig.scheduleTitle, x + 4, cy);
  cy += 5;
  doc.setFontSize(6.5);
  floorPlan.rooms.slice(0, 12).forEach((room) => {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(17, 24, 39);
    doc.text(room.label.slice(0, 23), x + 4, cy);
    doc.text(`${roomArea(room)} m²`, x + w - 4, cy, { align: "right" });
    cy += 4.5;
  });
  if (floorPlan.rooms.length > 12) {
    doc.setTextColor(107, 114, 128);
    doc.text(`+ ${floorPlan.rooms.length - 12} more rooms`, x + 4, cy);
    cy += 5;
  }

  const concept = floorPlan.interiorConcepts?.[0];
  if (concept) {
    cy += 5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(17, 24, 39);
    doc.text("Interior Concept", x + 4, cy);
    cy += 4.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.2);
    doc.setTextColor(75, 85, 99);
    doc.text(`${concept.styleLabel}: ${concept.summary}`, x + 4, cy, { maxWidth: w - 8 });
    cy += 12;
  }

  const exteriorConcept = floorPlan.exteriorConcept;
  if (exteriorConcept) {
    cy += 5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(17, 24, 39);
    doc.text("Facade Concept", x + 4, cy);
    cy += 4.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.2);
    doc.setTextColor(75, 85, 99);
    doc.text(`${exteriorConcept.styleLabel}: ${exteriorConcept.summary}`, x + 4, cy, { maxWidth: w - 8 });
    cy += 12;
  }

  if (exportTemplate === "real_estate") {
    cy += 5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(17, 24, 39);
    doc.text("Listing Notes", x + 4, cy);
    cy += 4.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.2);
    doc.setTextColor(75, 85, 99);
    doc.text("Use this concept plan for buyer review, listing discussion, and early feasibility.", x + 4, cy, { maxWidth: w - 8 });
    cy += 9;
  } else if (exportTemplate === "technical") {
    cy += 5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(17, 24, 39);
    doc.text("Drawing Notes", x + 4, cy);
    cy += 4.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.2);
    doc.setTextColor(75, 85, 99);
    doc.text("Dimensions are schematic. Confirm structure, services, setbacks, and code before documentation.", x + 4, cy, { maxWidth: w - 8 });
    cy += 9;
  }

  cy = Math.max(cy + 6, y + 118);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(17, 24, 39);
  doc.text("Legend", x + 4, cy);
  cy += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  legendLine(doc, x + 4, cy, "Door gap + amber swing arc", "#f59e0b");
  cy += 5;
  legendLine(doc, x + 4, cy, "Window marker", "#06b6d4");
  cy += 5;
  legendLine(doc, x + 4, cy, "Room boundary", "#111827");
}

function drawPngExport(ctx: CanvasRenderingContext2D, floorPlan: FloorPlan, metadata: ExportMetadata, width: number, height: number, exportTemplate: FloorPlanExportTemplate, exportQuality: FloorPlanExportQuality) {
  const templateConfig = getTemplateConfig(exportTemplate);
  const qualityConfig = getQualityConfig(exportQuality);
  const headerColor = `rgb(${templateConfig.header.r},${templateConfig.header.g},${templateConfig.header.b})`;
  const technical = exportTemplate === "technical";
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = headerColor;
  ctx.fillRect(0, 0, width, 132);
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 36px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText(metadata.title?.trim() || "Archy AI Floor Plan", 56, 58);
  ctx.font = "500 17px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText(`${templateConfig.eyebrow} · ${qualityConfig.label} · Generated ${new Date().toLocaleDateString()} · Scale: 1 grid square = 1m`, 56, 92);

  const bounds = getPlanBounds(floorPlan.rooms);
  const planX = 56;
  const planY = 170;
  const planW = 1220;
  const planH = 880;
  const panelX = 1320;
  const scale = Math.min(planW / bounds.width, planH / bounds.height);
  const offX = planX + (planW - bounds.width * scale) / 2;
  const offY = planY + (planH - bounds.height * scale) / 2;

  ctx.fillStyle = "#ffffff";
  roundRect(ctx, planX - 18, planY - 18, planW + 36, planH + 36, 22);
  ctx.fill();
  ctx.strokeStyle = "#dbe3ef";
  ctx.lineWidth = 2;
  ctx.stroke();
  drawCanvasGrid(ctx, bounds, scale, offX, offY);

  floorPlan.rooms.forEach((room, index) => {
    const rect = mapRoom(room, bounds, scale, offX, offY);
    const material = getRoomMaterial(floorPlan, room.id);
    ctx.fillStyle = technical ? "rgba(17,24,39,0.06)" : material ? withAlpha(material.floorColor, "b8") : `${PALETTE[index % PALETTE.length]}26`;
    ctx.strokeStyle = technical ? "#111827" : material?.accentColor ?? "#111827";
    ctx.lineWidth = technical ? 2.5 : 2;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    drawCanvasFurniture(ctx, rect, roomFurniture(floorPlan, room.id), scale, technical);
    ctx.fillStyle = "#111827";
    ctx.textAlign = "center";
    ctx.font = `700 ${Math.max(14, Math.min(22, rect.w / 8))}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillText(room.label, rect.x + rect.w / 2, rect.y + rect.h / 2 - 4);
    ctx.font = "500 13px ui-sans-serif, system-ui, sans-serif";
    ctx.fillStyle = "#4b5563";
    ctx.fillText(`${roomArea(room)} m²`, rect.x + rect.w / 2, rect.y + rect.h / 2 + 18);
    drawCanvasRoomDimensions(ctx, rect, room);
  });

  floorPlan.doors?.forEach((door) => drawCanvasDoor(ctx, floorPlan.rooms, door, bounds, scale, offX, offY));
  floorPlan.windows?.forEach((window) => drawCanvasWindow(ctx, floorPlan.rooms, window, bounds, scale, offX, offY));
  drawCanvasScaleBar(ctx, offX + 18, offY + bounds.height * scale - 22, bounds, scale);
  drawCanvasPanel(ctx, floorPlan, panelX, planY, 410, planH, exportTemplate, exportQuality);
}

function drawPdfGrid(doc: import("jspdf").jsPDF, bounds: PlanBounds, scale: number, offX: number, offY: number) {
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.12);
  const step = CANVAS_UNITS_PER_METER;
  for (let x = Math.floor(bounds.minX / step) * step; x <= bounds.maxX; x += step) {
    const px = offX + (x - bounds.minX) * scale;
    doc.line(px, offY, px, offY + bounds.height * scale);
  }
  for (let y = Math.floor(bounds.minY / step) * step; y <= bounds.maxY; y += step) {
    const py = offY + (y - bounds.minY) * scale;
    doc.line(offX, py, offX + bounds.width * scale, py);
  }
}

function drawCanvasGrid(ctx: CanvasRenderingContext2D, bounds: PlanBounds, scale: number, offX: number, offY: number) {
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1;
  const step = CANVAS_UNITS_PER_METER;
  for (let x = Math.floor(bounds.minX / step) * step; x <= bounds.maxX; x += step) {
    const px = offX + (x - bounds.minX) * scale;
    line(ctx, px, offY, px, offY + bounds.height * scale);
  }
  for (let y = Math.floor(bounds.minY / step) * step; y <= bounds.maxY; y += step) {
    const py = offY + (y - bounds.minY) * scale;
    line(ctx, offX, py, offX + bounds.width * scale, py);
  }
}

function drawPdfFurniture(
  doc: import("jspdf").jsPDF,
  rect: ReturnType<typeof mapRoom>,
  furniture: FurnitureItem[],
  scale: number,
  technical: boolean,
) {
  for (const item of furniture) {
    const itemRect = {
      x: rect.x + item.x * scale,
      y: rect.y + item.y * scale,
      w: item.width * scale,
      h: item.height * scale,
    };
    if (itemRect.w < 2 || itemRect.h < 2) continue;

    const colors = furnitureColors(item.type, technical);
    const fill = hexToRgb(colors.fill);
    const stroke = hexToRgb(colors.stroke);
    const text = hexToRgb(colors.text);
    doc.setGState(doc.GState({ opacity: technical ? 0.55 : 0.72 }));
    doc.setFillColor(fill.r, fill.g, fill.b);
    doc.setDrawColor(stroke.r, stroke.g, stroke.b);
    doc.setLineWidth(0.16);
    doc.roundedRect(itemRect.x, itemRect.y, itemRect.w, itemRect.h, Math.min(1.5, itemRect.w / 6, itemRect.h / 6), Math.min(1.5, itemRect.w / 6, itemRect.h / 6), "FD");
    doc.setGState(doc.GState({ opacity: 1 }));

    const label = furnitureLabel(item);
    if (!label || itemRect.w < 8 || itemRect.h < 5) continue;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(Math.max(3.2, Math.min(4.6, itemRect.w / Math.max(label.length, 3))));
    doc.setTextColor(text.r, text.g, text.b);
    doc.text(label, itemRect.x + itemRect.w / 2, itemRect.y + itemRect.h / 2 + 1.2, { align: "center" });
  }
}

function drawCanvasFurniture(
  ctx: CanvasRenderingContext2D,
  rect: ReturnType<typeof mapRoom>,
  furniture: FurnitureItem[],
  scale: number,
  technical: boolean,
) {
  ctx.save();
  for (const item of furniture) {
    const x = rect.x + item.x * scale;
    const y = rect.y + item.y * scale;
    const w = item.width * scale;
    const h = item.height * scale;
    if (w < 6 || h < 6) continue;

    const colors = furnitureColors(item.type, technical);
    ctx.globalAlpha = technical ? 0.68 : 0.86;
    ctx.fillStyle = colors.fill;
    ctx.strokeStyle = colors.stroke;
    ctx.lineWidth = 1.5;
    roundRect(ctx, x, y, w, h, Math.min(9, w / 7, h / 7));
    ctx.fill();
    ctx.stroke();
    ctx.globalAlpha = 1;

    const label = furnitureLabel(item);
    if (!label || w < 34 || h < 20) continue;
    ctx.fillStyle = colors.text;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 ${Math.max(8, Math.min(12, w / Math.max(label.length * 0.55, 3), h / 2.3))}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillText(label, x + w / 2, y + h / 2);
  }
  ctx.restore();
}

function drawPdfRoomDimensions(doc: import("jspdf").jsPDF, rect: ReturnType<typeof mapRoom>, room: Room) {
  if (rect.w < 20 || rect.h < 18) return;

  const horizontalY = rect.y + rect.h - Math.min(3, rect.h / 5);
  const horizontalStart = rect.x + 2;
  const horizontalEnd = rect.x + rect.w - 2;
  const verticalX = rect.x + rect.w - Math.min(3, rect.w / 5);
  const verticalStart = rect.y + 2;
  const verticalEnd = rect.y + rect.h - 2;

  doc.setDrawColor(75, 85, 99);
  doc.setTextColor(75, 85, 99);
  doc.setLineWidth(0.16);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(4.6);

  doc.line(horizontalStart, horizontalY, horizontalEnd, horizontalY);
  doc.line(horizontalStart, horizontalY - 1.4, horizontalStart, horizontalY + 1.4);
  doc.line(horizontalEnd, horizontalY - 1.4, horizontalEnd, horizontalY + 1.4);
  doc.text(formatLengthMeters(room.width), rect.x + rect.w / 2, horizontalY - 1.4, { align: "center" });

  if (rect.h >= 24 && rect.w >= 28) {
    doc.line(verticalX, verticalStart, verticalX, verticalEnd);
    doc.line(verticalX - 1.4, verticalStart, verticalX + 1.4, verticalStart);
    doc.line(verticalX - 1.4, verticalEnd, verticalX + 1.4, verticalEnd);
    doc.text(formatLengthMeters(room.height), verticalX - 1.4, rect.y + rect.h / 2, { align: "center", angle: 90 });
  }
}

function drawCanvasRoomDimensions(ctx: CanvasRenderingContext2D, rect: ReturnType<typeof mapRoom>, room: Room) {
  if (rect.w < 70 || rect.h < 52) return;

  const horizontalY = rect.y + rect.h - Math.min(20, rect.h / 4);
  const horizontalStart = rect.x + 12;
  const horizontalEnd = rect.x + rect.w - 12;
  const verticalX = rect.x + rect.w - Math.min(20, rect.w / 4);
  const verticalStart = rect.y + 12;
  const verticalEnd = rect.y + rect.h - 12;

  ctx.save();
  ctx.strokeStyle = "#4b5563";
  ctx.fillStyle = "#4b5563";
  ctx.lineWidth = 1.2;
  ctx.font = "700 11px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  line(ctx, horizontalStart, horizontalY, horizontalEnd, horizontalY);
  line(ctx, horizontalStart, horizontalY - 6, horizontalStart, horizontalY + 6);
  line(ctx, horizontalEnd, horizontalY - 6, horizontalEnd, horizontalY + 6);
  ctx.fillText(formatLengthMeters(room.width), rect.x + rect.w / 2, horizontalY - 10);

  if (rect.h >= 78 && rect.w >= 92) {
    line(ctx, verticalX, verticalStart, verticalX, verticalEnd);
    line(ctx, verticalX - 6, verticalStart, verticalX + 6, verticalStart);
    line(ctx, verticalX - 6, verticalEnd, verticalX + 6, verticalEnd);
    ctx.translate(verticalX - 11, rect.y + rect.h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(formatLengthMeters(room.height), 0, 0);
  }

  ctx.restore();
}

function drawPdfScaleBar(doc: import("jspdf").jsPDF, x: number, y: number, bounds: PlanBounds, scale: number) {
  const meters = chooseScaleBarMeters(bounds.width / CANVAS_UNITS_PER_METER);
  const width = meters * CANVAS_UNITS_PER_METER * scale;

  doc.setFillColor(255, 255, 255);
  doc.setGState(doc.GState({ opacity: 0.9 }));
  doc.rect(x - 2, y - 6.5, width + 16, 10, "F");
  doc.setGState(doc.GState({ opacity: 1 }));
  doc.setDrawColor(17, 24, 39);
  doc.setTextColor(17, 24, 39);
  doc.setLineWidth(0.45);
  doc.line(x, y, x + width, y);
  doc.line(x, y - 2, x, y + 2);
  doc.line(x + width, y - 2, x + width, y + 2);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(5.6);
  doc.text(`${meters}m`, x + width / 2, y - 2.8, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5);
  doc.text("scale bar", x + width + 4, y + 1.2);
}

function drawCanvasScaleBar(ctx: CanvasRenderingContext2D, x: number, y: number, bounds: PlanBounds, scale: number) {
  const meters = chooseScaleBarMeters(bounds.width / CANVAS_UNITS_PER_METER);
  const width = meters * CANVAS_UNITS_PER_METER * scale;

  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  roundRect(ctx, x - 12, y - 30, width + 100, 44, 12);
  ctx.fill();
  ctx.strokeStyle = "#111827";
  ctx.fillStyle = "#111827";
  ctx.lineWidth = 3;
  line(ctx, x, y, x + width, y);
  line(ctx, x, y - 11, x, y + 11);
  line(ctx, x + width, y - 11, x + width, y + 11);
  ctx.font = "700 14px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`${meters}m`, x + width / 2, y - 15);
  ctx.font = "600 12px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("scale bar", x + width + 16, y + 5);
  ctx.restore();
}

function drawPdfDoor(doc: import("jspdf").jsPDF, rooms: Room[], door: Door, bounds: PlanBounds, scale: number, offX: number, offY: number) {
  const room = rooms.find((candidate) => candidate.id === door.roomId);
  if (!room) return;
  const segment = openingSegment(room, bounds, scale, offX, offY, door.wall, door.position, getOpeningWidthMeters(door, "door"));
  const swing = doorSwingGeometry(segment, door, segment.length);
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(1.4);
  doc.line(segment.x1, segment.y1, segment.x2, segment.y2);
  doc.setDrawColor(245, 158, 11);
  doc.setLineWidth(0.45);
  drawPdfPolyline(doc, swing.arcPoints);
  doc.line(swing.hinge.x, swing.hinge.y, swing.leafEnd.x, swing.leafEnd.y);
}

function drawPdfWindow(doc: import("jspdf").jsPDF, rooms: Room[], window: FloorPlanWindow, bounds: PlanBounds, scale: number, offX: number, offY: number) {
  const room = rooms.find((candidate) => candidate.id === window.roomId);
  if (!room) return;
  const segment = openingSegment(room, bounds, scale, offX, offY, window.wall, window.position, getOpeningWidthMeters(window, "window"));
  doc.setDrawColor(6, 182, 212);
  doc.setLineWidth(0.8);
  doc.line(segment.x1, segment.y1, segment.x2, segment.y2);
}

function drawCanvasDoor(ctx: CanvasRenderingContext2D, rooms: Room[], door: Door, bounds: PlanBounds, scale: number, offX: number, offY: number) {
  const room = rooms.find((candidate) => candidate.id === door.roomId);
  if (!room) return;
  const segment = openingSegment(room, bounds, scale, offX, offY, door.wall, door.position, getOpeningWidthMeters(door, "door"));
  const swing = doorSwingGeometry(segment, door, segment.length);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 7;
  line(ctx, segment.x1, segment.y1, segment.x2, segment.y2);
  ctx.strokeStyle = "#f59e0b";
  ctx.lineWidth = 2.5;
  ctx.setLineDash([8, 6]);
  polyline(ctx, swing.arcPoints);
  ctx.setLineDash([]);
  line(ctx, swing.hinge.x, swing.hinge.y, swing.leafEnd.x, swing.leafEnd.y);
}

function drawCanvasWindow(ctx: CanvasRenderingContext2D, rooms: Room[], window: FloorPlanWindow, bounds: PlanBounds, scale: number, offX: number, offY: number) {
  const room = rooms.find((candidate) => candidate.id === window.roomId);
  if (!room) return;
  const segment = openingSegment(room, bounds, scale, offX, offY, window.wall, window.position, getOpeningWidthMeters(window, "window"));
  ctx.strokeStyle = "#06b6d4";
  ctx.lineWidth = 5;
  ctx.setLineDash([10, 6]);
  line(ctx, segment.x1, segment.y1, segment.x2, segment.y2);
  ctx.setLineDash([]);
}

function drawCanvasPanel(ctx: CanvasRenderingContext2D, floorPlan: FloorPlan, x: number, y: number, w: number, h: number, exportTemplate: FloorPlanExportTemplate, exportQuality: FloorPlanExportQuality) {
  const stats = getPlanStats(floorPlan);
  const templateConfig = getTemplateConfig(exportTemplate);
  const qualityConfig = getQualityConfig(exportQuality);
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, x, y, w, h, 22);
  ctx.fill();
  ctx.strokeStyle = "#dbe3ef";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#111827";
  ctx.textAlign = "left";
  ctx.font = "700 24px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText(templateConfig.panelTitle, x + 28, y + 42);
  const metrics = [
    ["Total area", `${floorPlan.totalArea || stats.area} m²`],
    ["Rooms", `${floorPlan.rooms.length}`],
    ["Bedrooms", `${stats.beds}`],
    ["Bathrooms", `${stats.baths}`],
    ["Doors", `${floorPlan.doors?.length ?? 0}`],
    ["Windows", `${floorPlan.windows?.length ?? 0}`],
    ["Furniture", `${floorPlan.furniture?.length ?? 0}`],
    ["Concepts", `${(floorPlan.interiorConcepts?.length ?? 0) + (floorPlan.exteriorConcept ? 1 : 0)}`],
    ["Quality", qualityConfig.label],
  ];
  let cy = y + 82;
  for (const [label, value] of metrics) {
    ctx.font = "500 15px ui-sans-serif, system-ui, sans-serif";
    ctx.fillStyle = "#6b7280";
    ctx.fillText(label, x + 28, cy);
    ctx.font = "700 15px ui-sans-serif, system-ui, sans-serif";
    ctx.fillStyle = "#111827";
    ctx.textAlign = "right";
    ctx.fillText(value, x + w - 28, cy);
    ctx.textAlign = "left";
    cy += 31;
  }

  cy += 22;
  ctx.font = "700 22px ui-sans-serif, system-ui, sans-serif";
  ctx.fillStyle = "#111827";
  ctx.fillText(templateConfig.scheduleTitle, x + 28, cy);
  cy += 35;
  ctx.font = "500 14px ui-sans-serif, system-ui, sans-serif";
  floorPlan.rooms.slice(0, 12).forEach((room) => {
    ctx.fillStyle = "#111827";
    ctx.fillText(room.label.slice(0, 26), x + 28, cy);
    ctx.textAlign = "right";
    ctx.fillText(`${roomArea(room)} m²`, x + w - 28, cy);
    ctx.textAlign = "left";
    cy += 24;
  });
  if (floorPlan.rooms.length > 12) {
    ctx.fillStyle = "#6b7280";
    ctx.fillText(`+ ${floorPlan.rooms.length - 12} more rooms`, x + 28, cy);
  }

  const concept = floorPlan.interiorConcepts?.[0];
  if (concept) {
    cy += 34;
    ctx.font = "700 18px ui-sans-serif, system-ui, sans-serif";
    ctx.fillStyle = "#111827";
    ctx.fillText("Interior Concept", x + 28, cy);
    cy += 26;
    ctx.font = "500 13px ui-sans-serif, system-ui, sans-serif";
    ctx.fillStyle = "#6b7280";
    wrapCanvasText(ctx, `${concept.styleLabel}: ${concept.summary}`, x + 28, cy, w - 56, 18, 4);
    cy += 80;
  }

  const exteriorConcept = floorPlan.exteriorConcept;
  if (exteriorConcept) {
    cy += 34;
    ctx.font = "700 18px ui-sans-serif, system-ui, sans-serif";
    ctx.fillStyle = "#111827";
    ctx.fillText("Facade Concept", x + 28, cy);
    cy += 26;
    ctx.font = "500 13px ui-sans-serif, system-ui, sans-serif";
    ctx.fillStyle = "#6b7280";
    wrapCanvasText(ctx, `${exteriorConcept.styleLabel}: ${exteriorConcept.summary}`, x + 28, cy, w - 56, 18, 4);
    cy += 80;
  }

  if (exportTemplate === "technical" || exportTemplate === "real_estate") {
    cy += 34;
    ctx.font = "700 18px ui-sans-serif, system-ui, sans-serif";
    ctx.fillStyle = "#111827";
    ctx.fillText(exportTemplate === "technical" ? "Drawing Notes" : "Listing Notes", x + 28, cy);
    cy += 26;
    ctx.font = "500 13px ui-sans-serif, system-ui, sans-serif";
    ctx.fillStyle = "#6b7280";
    wrapCanvasText(
      ctx,
      exportTemplate === "technical"
        ? "Schematic dimensions only. Confirm code, structure, services, and survey data before documentation."
        : "Buyer-friendly concept plan for listing review, project comparison, and early feasibility discussion.",
      x + 28,
      cy,
      w - 56,
      18,
      3,
    );
  }

  ctx.font = "700 18px ui-sans-serif, system-ui, sans-serif";
  ctx.fillStyle = "#111827";
  ctx.fillText("Legend", x + 28, y + h - 100);
  canvasLegendLine(ctx, x + 28, y + h - 66, "#f59e0b", "Door + swing");
  canvasLegendLine(ctx, x + 28, y + h - 36, "#06b6d4", "Window marker");
}

function openingSegment(room: Room, bounds: PlanBounds, scale: number, offX: number, offY: number, wall: WallSide, position: number, widthMeters: number) {
  const rect = mapRoom(room, bounds, scale, offX, offY);
  const gap = widthMeters * CANVAS_UNITS_PER_METER * scale;
  const p = Math.min(Math.max(position, 0), 1);
  if (wall === "top") {
    const cx = rect.x + rect.w * p;
    return { x1: cx - gap / 2, y1: rect.y, x2: cx + gap / 2, y2: rect.y, length: gap };
  }
  if (wall === "bottom") {
    const cx = rect.x + rect.w * p;
    return { x1: cx - gap / 2, y1: rect.y + rect.h, x2: cx + gap / 2, y2: rect.y + rect.h, length: gap };
  }
  if (wall === "left") {
    const cy = rect.y + rect.h * p;
    return { x1: rect.x, y1: cy - gap / 2, x2: rect.x, y2: cy + gap / 2, length: gap };
  }
  const cy = rect.y + rect.h * p;
  return { x1: rect.x + rect.w, y1: cy - gap / 2, x2: rect.x + rect.w, y2: cy + gap / 2, length: gap };
}

function doorSwingGeometry(segment: { x1: number; y1: number; x2: number; y2: number }, door: Door, width: number) {
  const hingeIsLeft = getDoorHinge(door) === "left";
  const hinge = hingeIsLeft ? { x: segment.x1, y: segment.y1 } : { x: segment.x2, y: segment.y2 };
  const closedEnd = hingeIsLeft ? { x: segment.x2, y: segment.y2 } : { x: segment.x1, y: segment.y1 };
  const closedVector = { x: closedEnd.x - hinge.x, y: closedEnd.y - hinge.y };
  const openVector = doorOpenVector(door.wall, getDoorSwing(door), width);
  const leafEnd = { x: hinge.x + openVector.x, y: hinge.y + openVector.y };
  return { hinge, leafEnd, arcPoints: arcPoints(hinge, closedVector, openVector, width) };
}

function doorOpenVector(wall: WallSide, swing: ReturnType<typeof getDoorSwing>, width: number) {
  if (wall === "top") return { x: 0, y: swing === "inward" ? width : -width };
  if (wall === "bottom") return { x: 0, y: swing === "inward" ? -width : width };
  if (wall === "left") return { x: swing === "inward" ? width : -width, y: 0 };
  return { x: swing === "inward" ? -width : width, y: 0 };
}

function arcPoints(center: { x: number; y: number }, startVector: { x: number; y: number }, endVector: { x: number; y: number }, radius: number) {
  const points: Array<{ x: number; y: number }> = [];
  const steps = 12;
  const startAngle = Math.atan2(startVector.y, startVector.x);
  const endAngle = Math.atan2(endVector.y, endVector.x);
  let delta = endAngle - startAngle;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  for (let i = 0; i <= steps; i++) {
    const angle = startAngle + (delta * i) / steps;
    points.push({ x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius });
  }
  return points;
}

function drawPdfPolyline(doc: import("jspdf").jsPDF, points: Array<{ x: number; y: number }>) {
  for (let i = 1; i < points.length; i++) {
    doc.line(points[i - 1].x, points[i - 1].y, points[i].x, points[i].y);
  }
}

function polyline(ctx: CanvasRenderingContext2D, points: Array<{ x: number; y: number }>) {
  if (!points.length) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
  ctx.stroke();
}

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function mapRoom(room: Room, bounds: PlanBounds, scale: number, offX: number, offY: number) {
  return {
    x: offX + (room.x - bounds.minX) * scale,
    y: offY + (room.y - bounds.minY) * scale,
    w: room.width * scale,
    h: room.height * scale,
  };
}

function getPlanBounds(rooms: Room[]): PlanBounds {
  if (!rooms.length) return { minX: 0, minY: 0, maxX: 800, maxY: 600, width: 800, height: 600 };
  const minX = Math.min(...rooms.map((room) => room.x));
  const minY = Math.min(...rooms.map((room) => room.y));
  const maxX = Math.max(...rooms.map((room) => room.x + room.width));
  const maxY = Math.max(...rooms.map((room) => room.y + room.height));
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

function getPlanStats(floorPlan: FloorPlan) {
  return {
    area: Math.round(floorPlan.rooms.reduce((sum, room) => sum + roomArea(room), 0)),
    beds: floorPlan.rooms.filter((room) => room.type === "bedroom" || room.type === "master_bedroom").length,
    baths: floorPlan.rooms.filter((room) => room.type === "bathroom" || room.type === "ensuite").length,
  };
}

function roomArea(room: Room) {
  return Math.round((room.width * room.height) / 2500);
}

function roomFurniture(floorPlan: FloorPlan, roomId: string): FurnitureItem[] {
  return (floorPlan.furniture ?? []).filter((item) => item.roomId === roomId && item.width > 0 && item.height > 0);
}

function furnitureColors(type: FurnitureType, technical: boolean): { fill: string; stroke: string; text: string } {
  if (technical) return { fill: "#f8fafc", stroke: "#64748b", text: "#334155" };

  const colors: Record<FurnitureType, { fill: string; stroke: string; text: string }> = {
    bed: { fill: "#fef3c7", stroke: "#d97706", text: "#92400e" },
    wardrobe: { fill: "#ede9fe", stroke: "#7c3aed", text: "#5b21b6" },
    sofa: { fill: "#dcfce7", stroke: "#16a34a", text: "#166534" },
    coffee_table: { fill: "#ccfbf1", stroke: "#0f766e", text: "#115e59" },
    media_console: { fill: "#e0e7ff", stroke: "#4f46e5", text: "#3730a3" },
    dining_table: { fill: "#ffedd5", stroke: "#ea580c", text: "#9a3412" },
    chair: { fill: "#f5f5f4", stroke: "#78716c", text: "#44403c" },
    kitchen_counter: { fill: "#dbeafe", stroke: "#2563eb", text: "#1e40af" },
    kitchen_island: { fill: "#bfdbfe", stroke: "#1d4ed8", text: "#1e3a8a" },
    toilet: { fill: "#f8fafc", stroke: "#64748b", text: "#334155" },
    vanity: { fill: "#e0f2fe", stroke: "#0284c7", text: "#075985" },
    shower: { fill: "#cffafe", stroke: "#0891b2", text: "#155e75" },
    washer: { fill: "#f1f5f9", stroke: "#475569", text: "#334155" },
    desk: { fill: "#fae8ff", stroke: "#c026d3", text: "#86198f" },
    car: { fill: "#e2e8f0", stroke: "#334155", text: "#1e293b" },
    storage: { fill: "#f3f4f6", stroke: "#6b7280", text: "#374151" },
  };
  return colors[type] ?? colors.storage;
}

function furnitureLabel(item: FurnitureItem): string {
  if (item.width < 34 || item.height < 20) return "";
  const labels: Record<FurnitureType, string> = {
    bed: "Bed",
    wardrobe: "Robe",
    sofa: "Sofa",
    coffee_table: "Table",
    media_console: "Media",
    dining_table: "Dining",
    chair: "Chair",
    kitchen_counter: "Counter",
    kitchen_island: "Island",
    toilet: "WC",
    vanity: "Vanity",
    shower: "Shower",
    washer: "Wash",
    desk: "Desk",
    car: "Car",
    storage: "Store",
  };
  return labels[item.type] ?? item.label;
}

function getExportTemplate(value: FloorPlanExportTemplate | undefined): FloorPlanExportTemplate {
  return value && FLOOR_PLAN_EXPORT_TEMPLATES.some((template) => template.value === value) ? value : "presentation";
}

function getExportQuality(value: FloorPlanExportQuality | undefined): FloorPlanExportQuality {
  return value && FLOOR_PLAN_EXPORT_QUALITIES.some((quality) => quality.value === value) ? value : "standard";
}

function getQualityConfig(quality: FloorPlanExportQuality) {
  if (quality === "print") {
    return {
      label: "Print",
      pdfFormat: "a3" as const,
      pdfPageW: 420,
      pdfPageH: 297,
      pngWidth: 4200,
      pngHeight: 2800,
    };
  }
  if (quality === "high") {
    return {
      label: "High Resolution",
      pdfFormat: "a4" as const,
      pdfPageW: 297,
      pdfPageH: 210,
      pngWidth: 3000,
      pngHeight: 2000,
    };
  }
  return {
    label: "Standard",
    pdfFormat: "a4" as const,
    pdfPageW: 297,
    pdfPageH: 210,
    pngWidth: 1800,
    pngHeight: 1200,
  };
}

function getTemplateConfig(template: FloorPlanExportTemplate) {
  if (template === "technical") {
    return {
      eyebrow: "Technical Drawing Set",
      headerRight: "Technical export",
      panelTitle: "Drawing Summary",
      scheduleTitle: "Room Schedule",
      disclaimer: "Schematic technical plan only. Verify dimensions, code requirements, structure, and services before documentation.",
      header: { r: 15, g: 23, b: 42 },
    };
  }
  if (template === "real_estate") {
    return {
      eyebrow: "Real Estate Preview",
      headerRight: "Listing export",
      panelTitle: "Buyer Summary",
      scheduleTitle: "Area Schedule",
      disclaimer: "Marketing concept plan only. All dimensions and areas are indicative and must be independently verified.",
      header: { r: 39, g: 64, b: 55 },
    };
  }
  return {
    eyebrow: "Client Presentation",
    headerRight: "Presentation export",
    panelTitle: "Project Summary",
    scheduleTitle: "Room Schedule",
    disclaimer: "Concept plan only. Verify all dimensions, code requirements, structure, and services before construction.",
    header: { r: 17, g: 24, b: 39 },
  };
}

function wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number) {
  const words = text.split(" ");
  let line = "";
  let lineCount = 0;
  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line, x, y + lineCount * lineHeight);
      line = word;
      lineCount += 1;
      if (lineCount >= maxLines) return;
    } else {
      line = testLine;
    }
  }
  if (line && lineCount < maxLines) ctx.fillText(line, x, y + lineCount * lineHeight);
}

function formatLengthMeters(canvasUnits: number) {
  const meters = canvasUnits / CANVAS_UNITS_PER_METER;
  return `${Number.isInteger(meters) ? meters.toFixed(0) : meters.toFixed(1)}m`;
}

function chooseScaleBarMeters(planWidthMeters: number) {
  if (planWidthMeters >= 10) return 5;
  if (planWidthMeters >= 6) return 3;
  if (planWidthMeters >= 4) return 2;
  return 1;
}

function legendLine(doc: import("jspdf").jsPDF, x: number, y: number, label: string, color: string) {
  const rgb = hexToRgb(color);
  doc.setDrawColor(rgb.r, rgb.g, rgb.b);
  doc.setLineWidth(0.8);
  doc.line(x, y - 1.5, x + 9, y - 1.5);
  doc.setTextColor(17, 24, 39);
  doc.text(label, x + 12, y);
}

function canvasLegendLine(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, label: string) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  line(ctx, x, y - 5, x + 38, y - 5);
  ctx.fillStyle = "#111827";
  ctx.font = "500 15px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText(label, x + 52, y);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

function withAlpha(hex: string, alpha: string) {
  return `${hex}${alpha}`;
}
