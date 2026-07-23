type ReportVisits = {
  total: number;
  scheduled: number;
  completed: number;
  noShow: number;
  cancelled: number;
};

type ReportMoney = {
  received: number;
  cash: number;
  card: number;
  expected: number;
  noShowPaid: number;
  cancelled: number;
};

type ReportDay = {
  date: string;
  count: number;
  completed: number;
  amount: number;
};

type ReportStatus = {
  status: string;
  count: number;
};

type ReportExpense = {
  name: string;
  amount: number;
  paymentMethod?: "cash" | "card";
};

export type DashboardStatsPdfInput = {
  logoSrc: string;
  rangeLabel: string;
  generatedAt: string;
  visits: ReportVisits;
  money: ReportMoney;
  days: ReportDay[];
  statuses: ReportStatus[];
  expenses: ReportExpense[];
};

const pageWidthPx = 1240;
const pageHeightPx = Math.round(pageWidthPx * 297 / 210);
const margin = 64;

export async function downloadDashboardStatsPdf(input: DashboardStatsPdfInput) {
  const { jsPDF } = await import("jspdf");
  const canvas = await drawReportCanvas(input);
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidthMm = pdf.internal.pageSize.getWidth();
  const pageHeightMm = pdf.internal.pageSize.getHeight();

  for (let offset = 0, page = 0; offset < canvas.height; offset += pageHeightPx, page += 1) {
    const slice = document.createElement("canvas");
    slice.width = canvas.width;
    slice.height = Math.min(pageHeightPx, canvas.height - offset);
    const ctx = slice.getContext("2d");
    if (!ctx) throw new Error("Canvas is not supported");
    ctx.drawImage(canvas, 0, offset, canvas.width, slice.height, 0, 0, canvas.width, slice.height);

    if (page > 0) pdf.addPage();
    pdf.addImage(slice.toDataURL("image/png"), "PNG", 0, 0, pageWidthMm, (slice.height / slice.width) * pageWidthMm);
    if (slice.height < pageHeightPx) {
      pdf.setFillColor(255, 252, 246);
      pdf.rect(0, (slice.height / slice.width) * pageWidthMm, pageWidthMm, pageHeightMm, "F");
    }
  }

  pdf.save(`soloway-statystyka-${safeFileDate(input.rangeLabel)}.pdf`);
}

async function drawReportCanvas(input: DashboardStatsPdfInput) {
  const expensesHeight = input.expenses.length ? input.expenses.length * 44 + 130 : 112;
  const height = Math.max(1180, 720 + expensesHeight);
  const canvas = document.createElement("canvas");
  canvas.width = pageWidthPx;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not supported");

  ctx.fillStyle = "#fff7ed";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, 32, 32, canvas.width - 64, canvas.height - 64, 32, true);
  ctx.fillStyle = "#e56a4f";
  roundRect(ctx, 32, 32, canvas.width - 64, 18, 9, true);

  let y = 86;
  const logo = await loadImage(input.logoSrc).catch(() => null);
  if (logo) {
    ctx.drawImage(logo, margin, y - 6, 82, 82);
  }

  drawText(ctx, "Soloway CRM", margin + 104, y + 18, 28, "#3a251b", "800");
  drawText(ctx, "Короткий звіт", margin + 104, y + 60, 54, "#2f211a", "900");
  drawPill(ctx, pageWidthPx - margin - 250, y + 12, 250, 44, "для керівництва", "#fce8ca", "#5b4031");
  y += 122;

  drawText(ctx, input.rangeLabel, margin, y, 26, "#5b4031", "800");
  drawText(ctx, `Сформовано: ${input.generatedAt}`, margin, y + 34, 20, "#8a786a", "500");
  y += 92;

  const completedRate = input.visits.scheduled ? Math.round((input.visits.completed / input.visits.scheduled) * 100) : 0;
  const expensesTotal = sum(input.expenses.map((expense) => expense.amount));
  const cashExpenses = sum(input.expenses.filter((expense) => expense.paymentMethod !== "card").map((expense) => expense.amount));
  const cardExpenses = sum(input.expenses.filter((expense) => expense.paymentMethod === "card").map((expense) => expense.amount));
  const netReceived = input.money.received - expensesTotal;
  const inactiveVisits = input.visits.noShow + input.visits.cancelled;

  y = drawSectionTitle(ctx, "Головне", y);
  y = drawMetricGrid(ctx, y, [
    ["Отримано", formatUAH(input.money.received), "Оплачені бронювання"],
    ["Витрати", formatUAH(expensesTotal), input.expenses.length ? `${input.expenses.length} позицій` : "Не додано"],
    ["Після витрат", formatUAH(netReceived), netReceived >= 0 ? "Чистий підсумок" : "Мінус"],
  ], 3, 160, true);

  y = drawSectionTitle(ctx, "Оплата", y + 26);
  y = drawMetricGrid(ctx, y, [
    ["Готівка", formatUAH(input.money.cash), "Оплачено готівкою"],
    ["Картка", formatUAH(input.money.card), "Оплачено карткою"],
    ["Витрати готівкою", formatUAH(cashExpenses), "Додаткові витрати"],
    ["Витрати карткою", formatUAH(cardExpenses), "Додаткові витрати"],
  ], 4, 130);

  y = drawSectionTitle(ctx, "Візити", y + 26);
  y = drawMetricGrid(ctx, y, [
    ["Активних", String(input.visits.scheduled), "Без скасованих і не прийшли"],
    ["Завершено", String(input.visits.completed), `${completedRate}% активних`],
    ["Не відбулись", String(inactiveVisits), "Не прийшли + скасовано"],
  ], 3, 130);

  if (input.money.expected > 0 || input.money.noShowPaid > 0) {
    y = drawNotice(ctx, y + 18, [
      input.money.expected > 0 ? `Очікується оплата: ${formatUAH(input.money.expected)}` : "",
      input.money.noShowPaid > 0 ? `Оплачені, але не прийшли: ${formatUAH(input.money.noShowPaid)}` : "",
    ].filter(Boolean).join(" · "));
  }

  y = drawSectionTitle(ctx, "Витрати", y + 28);
  y = drawExpenseTable(ctx, y, input.expenses, expensesTotal);

  drawText(ctx, "Тільки ключові показники для швидкого перегляду в месенджері.", margin, y + 16, 18, "#8a786a", "600");

  return canvas;
}

function drawMetricGrid(
  ctx: CanvasRenderingContext2D,
  y: number,
  items: Array<[string, string, string]>,
  columns = 4,
  cardHeight = 132,
  emphasized = false,
) {
  const gap = 18;
  const cardWidth = (pageWidthPx - margin * 2 - gap * (columns - 1)) / columns;
  items.forEach(([label, value, note], index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    const x = margin + col * (cardWidth + gap);
    const top = y + row * (cardHeight + gap);
    ctx.fillStyle = emphasized && index === 2 ? "#eaf8ef" : "#fff9f2";
    roundRect(ctx, x, top, cardWidth, cardHeight, 22, true);
    ctx.strokeStyle = emphasized && index === 2 ? "#9cd8af" : "#eadccf";
    ctx.lineWidth = 2;
    roundRect(ctx, x, top, cardWidth, cardHeight, 22, false);
    drawText(ctx, label, x + 24, top + 36, 19, "#7a6758", "800");
    drawText(ctx, value, x + 24, top + 84, 36, emphasized && index === 2 ? "#146c3d" : "#2f211a", "900");
    drawText(ctx, note, x + 24, top + cardHeight - 24, 16, "#8a786a", "600");
  });
  return y + Math.ceil(items.length / columns) * (cardHeight + gap);
}

function drawExpenseTable(ctx: CanvasRenderingContext2D, y: number, expenses: ReportExpense[], total: number) {
  const width = pageWidthPx - margin * 2;
  ctx.fillStyle = "#fce8ca";
  roundRect(ctx, margin, y, width, 50, 14, true);
  drawText(ctx, "Витрата", margin + 24, y + 32, 18, "#5b4031", "900");
  drawText(ctx, "Оплата", margin + width - 330, y + 32, 18, "#5b4031", "900");
  drawText(ctx, "Сума", margin + width - 170, y + 32, 18, "#5b4031", "900");

  if (expenses.length === 0) {
    drawText(ctx, "Витрати не додані для цього звіту.", margin + 24, y + 96, 22, "#8a786a", "600");
    drawText(ctx, formatUAH(0), margin + width - 190, y + 96, 22, "#3a251b", "900");
    return y + 132;
  }

  expenses.forEach((expense, index) => {
    const top = y + 60 + index * 44;
    ctx.fillStyle = index % 2 === 0 ? "#fff9f2" : "#ffffff";
    roundRect(ctx, margin, top, width, 38, 10, true);
    drawText(ctx, truncate(expense.name || "Без назви", 48), margin + 24, top + 26, 18, "#3a251b", "700");
    drawText(ctx, expense.paymentMethod === "card" ? "Картка" : "Готівка", margin + width - 330, top + 26, 18, "#7a6758", "800");
    drawText(ctx, formatUAH(expense.amount), margin + width - 170, top + 26, 18, "#3a251b", "900");
  });

  const totalTop = y + 68 + expenses.length * 44;
  ctx.fillStyle = "#fff1df";
  roundRect(ctx, margin, totalTop, width, 44, 12, true);
  drawText(ctx, "Разом витрати", margin + 24, totalTop + 29, 20, "#5b4031", "900");
  drawText(ctx, formatUAH(total), margin + width - 170, totalTop + 29, 20, "#5b4031", "900");
  return totalTop + 72;
}

function drawSectionTitle(ctx: CanvasRenderingContext2D, title: string, y: number) {
  ctx.fillStyle = "#e56a4f";
  roundRect(ctx, margin, y - 20, 8, 34, 4, true);
  drawText(ctx, title, margin + 18, y, 30, "#2f211a", "900");
  return y + 34;
}

function drawNotice(ctx: CanvasRenderingContext2D, y: number, text: string) {
  const width = pageWidthPx - margin * 2;
  ctx.fillStyle = "#fff3cd";
  roundRect(ctx, margin, y, width, 58, 16, true);
  ctx.strokeStyle = "#f4d37d";
  ctx.lineWidth = 2;
  roundRect(ctx, margin, y, width, 58, 16, false);
  drawText(ctx, text, margin + 24, y + 36, 20, "#6a4a10", "800");
  return y + 78;
}

function drawPill(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, text: string, fill: string, color: string) {
  ctx.fillStyle = fill;
  roundRect(ctx, x, y, width, height, height / 2, true);
  drawText(ctx, text, x + 26, y + 28, 18, color, "800");
}

function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  color: string,
  weight: string,
) {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px Inter, Arial, sans-serif`;
  ctx.fillText(text, x, y);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number, fill: boolean) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
  if (fill) ctx.fill();
  else ctx.stroke();
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function formatUAH(value: number) {
  return `${Math.round(Number(value || 0)).toLocaleString("uk-UA")} ₴`;
}

function truncate(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + Number(value || 0), 0);
}

function safeFileDate(value: string) {
  return value.toLowerCase().replace(/[^0-9a-zа-яіїєґ-]+/gi, "-").replace(/^-|-$/g, "").slice(0, 80);
}
