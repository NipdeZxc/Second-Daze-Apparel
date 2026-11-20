const text = (key, label, optional = false) => ({ key, label, type: "text", optional });
const money = (key, label) => ({ key, label, type: "money" });
const quantity = (key, label) => ({ key, label, type: "quantity" });
const date = (key, label) => ({ key, label, type: "date" });
const status = (values) => ({ key: "status", label: "Status", type: "text", values });

export const datasets = {
  products: {
    label: "Products and inventory", key: "sku",
    columns: [
      text("sku", "SKU"), text("product_name", "Product"), text("category", "Category", true),
      text("size", "Size", true), text("color", "Color", true),
      money("cost_price", "Cost price"), money("selling_price", "Selling price"),
      quantity("qty_available", "Available"), quantity("low_stock_threshold", "Low-stock threshold"),
    ],
  },
  customers: {
    label: "Customers", key: "customer_code",
    columns: [
      text("customer_code", "Customer code"), text("full_name", "Customer"),
      text("contact_number", "Contact number"), text("email", "Email", true),
      text("address", "Address", true), text("city", "City", true),
    ],
  },
  orders: {
    label: "Orders", key: "order_no",
    columns: [
      text("order_no", "Order"), text("customer_code", "Customer code"),
      money("total_amount", "Amount"),
      status(["Pending", "Processing", "Shipped", "Completed", "Cancelled"]),
      date("ordered_at", "Ordered at"),
    ],
  },
  sales: {
    label: "Sales", key: "sale_no",
    columns: [
      text("sale_no", "Sale"), text("order_no", "Order"),
      money("amount", "Amount"), money("cost", "Cost"), date("sold_at", "Sold at"),
    ],
  },
  reservations: {
    label: "Reservations", key: "reservation_no",
    columns: [
      text("reservation_no", "Reservation"), text("customer_code", "Customer code"),
      status(["Awaiting Approval", "Approved", "Paid", "Expired", "Rejected", "Cancelled"]),
      date("expires_at", "Expires at"),
    ],
  },
};
