import { canAccessScreen, normalizeRole } from "../roles.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const ORDER_SCREEN = "3.9-orders-status-tracking";

function timestamp(value) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatElapsed(milliseconds) {
  const totalHours = Math.floor(milliseconds / (60 * 60 * 1000));
  if (totalHours < 1) return "less than 1 hour";
  if (totalHours < 24) return `${totalHours} ${totalHours === 1 ? "hour" : "hours"}`;
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return `${days} ${days === 1 ? "day" : "days"}${hours ? ` ${hours}h` : ""}`;
}

function addAgedItem(items, {
  role,
  category,
  screenId,
  title,
  searchTerm,
  status,
  date,
  thresholdDays,
  now,
  detail,
}) {
  const occurredAt = timestamp(date);
  if (occurredAt === null) return;
  const elapsed = now - occurredAt;
  if (elapsed < thresholdDays * DAY_MS || !canAccessScreen(role, screenId)) return;
  items.push({
    id: `${category}-${searchTerm || title}`,
    category,
    title,
    searchTerm,
    screenId,
    detail: [status, detail].filter(Boolean).join(" · "),
    ageLabel: `Waiting ${formatElapsed(elapsed)}`,
    urgency: "overdue",
    sortValue: elapsed,
  });
}

export function buildOverdueWorkQueue(records, role, now = new Date()) {
  if (!records || !Number.isFinite(now.getTime())) return [];

  const normalizedRole = normalizeRole(role);
  const isAdmin = normalizedRole === "Admin";
  const items = [];
  const addAccessible = (item) => {
    if (item && canAccessScreen(normalizedRole, item.screenId)) items.push(item);
  };

  for (const order of records.orders || []) {
    const title = order.order_number || `Order ${order.id}`;
    if (isAdmin && order.status === "Pending Approval") {
      addAgedItem(items, {
        role: normalizedRole,
        category: "Order approval",
        screenId: ORDER_SCREEN,
        title,
        searchTerm: title,
        status: order.status,
        date: order.ordered_at,
        thresholdDays: 1,
        now: now.getTime(),
        detail: order.customer_name,
      });
    }
    if (order.status === "Pending Payment") {
      addAgedItem(items, {
        role: normalizedRole,
        category: "Payment overdue",
        screenId: ORDER_SCREEN,
        title,
        searchTerm: title,
        status: order.status,
        date: order.ordered_at,
        thresholdDays: 1,
        now: now.getTime(),
        detail: order.customer_name,
      });
    }
    if (["Paid", "Packed", "For Shipping"].includes(order.status)) {
      addAgedItem(items, {
        role: normalizedRole,
        category: "Fulfillment overdue",
        screenId: ORDER_SCREEN,
        title,
        searchTerm: title,
        status: order.status,
        date: order.verified_at || order.ordered_at,
        thresholdDays: 2,
        now: now.getTime(),
        detail: order.customer_name,
      });
    }
  }

  if (isAdmin) {
    for (const account of records.accounts || []) {
      if (account.status !== "Pending Approval") continue;
      addAgedItem(items, {
        role: normalizedRole,
        category: "Access approval",
        screenId: "2.2-access-approvals",
        title: account.full_name || account.username || `Account ${account.id}`,
        searchTerm: account.username || account.full_name || "",
        status: account.status,
        date: account.created_at,
        thresholdDays: 1,
        now: now.getTime(),
      });
    }

    for (const refund of records.refunds || []) {
      if (refund.status !== "Pending Approval") continue;
      addAgedItem(items, {
        role: normalizedRole,
        category: "Refund approval",
        screenId: "2.4-refunds",
        title: refund.refund_number || `Refund ${refund.id}`,
        searchTerm: refund.refund_number || "",
        status: refund.status,
        date: refund.refund_date,
        thresholdDays: 3,
        now: now.getTime(),
        detail: refund.customer_name,
      });
    }
  }

  const reservationScreen = isAdmin ? "2.5-reservations" : "5-reservations";
  if (canAccessScreen(normalizedRole, reservationScreen)) {
    for (const reservation of records.reservations || []) {
      const title = reservation.reservation_number || `Reservation ${reservation.id}`;
      if (isAdmin && reservation.status === "Pending Approval") {
        addAgedItem(items, {
          role: normalizedRole,
          category: "Reservation approval",
          screenId: reservationScreen,
          title,
          searchTerm: title,
          status: reservation.status,
          date: reservation.created_at,
          thresholdDays: 1,
          now: now.getTime(),
          detail: reservation.customer_name,
        });
      }

      if (!["Active", "Pending Approval"].includes(reservation.status)) continue;
      const expiresAt = timestamp(reservation.expires_at);
      if (expiresAt === null || expiresAt - now.getTime() > DAY_MS) continue;
      const expired = expiresAt <= now.getTime();
      const untilExpiry = expiresAt - now.getTime();
      addAccessible({
        id: `reservation-expiry-${reservation.id ?? title}`,
        category: expired ? "Expired reservation" : "Reservation expiring",
        title,
        searchTerm: title,
        screenId: reservationScreen,
        detail: [reservation.status, reservation.customer_name].filter(Boolean).join(" · "),
        ageLabel: expired ? `Expired ${formatElapsed(-untilExpiry)} ago` : `Expires in ${formatElapsed(untilExpiry)}`,
        urgency: expired ? "overdue" : "due-soon",
        sortValue: Math.abs(untilExpiry),
      });
    }
  }

  return items.sort((left, right) => {
    if (left.urgency !== right.urgency) return left.urgency === "overdue" ? -1 : 1;
    return left.urgency === "overdue"
      ? right.sortValue - left.sortValue
      : left.sortValue - right.sortValue;
  });
}
