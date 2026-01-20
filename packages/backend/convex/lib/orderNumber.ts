import type { GenericDatabaseReader } from "convex/server";
import type { Id } from "../_generated/dataModel";
import type { DataModel } from "../_generated/dataModel";

function derivePrefix(businessName: string): string {
  const letters = businessName.replace(/[^a-zA-Z]/g, "");
  if (letters.length < 3) {
    return "BIZ";
  }
  return letters.substring(0, 3).toUpperCase();
}

/**
 * Generates a unique order number for a business.
 * Format: ORD-{prefix}-{number} (e.g., ORD-BUR-001234)
 */
export async function generateOrderNumber(
  db: GenericDatabaseReader<DataModel>,
  businessId: Id<"businesses">
): Promise<string> {
  const business = await db.get(businessId);
  if (!business) {
    throw new Error("Business not found");
  }

  const prefix = derivePrefix(business.name);

  const existingOrders = await db
    .query("orders")
    .withIndex("by_business", (q) => q.eq("businessId", businessId))
    .collect();

  let maxNumber = 0;
  const prefixPattern = `ORD-${prefix}-`;

  for (const order of existingOrders) {
    if (order.orderNumber.startsWith(prefixPattern)) {
      const numberPart = order.orderNumber.substring(prefixPattern.length);
      const num = parseInt(numberPart, 10);
      if (!isNaN(num) && num > maxNumber) {
        maxNumber = num;
      }
    }
  }

  const nextNumber = maxNumber + 1;
  const paddedNumber = nextNumber.toString().padStart(6, "0");

  return `ORD-${prefix}-${paddedNumber}`;
}
