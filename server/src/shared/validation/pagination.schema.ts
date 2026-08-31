import { z } from "zod";

export function paginationFields(defaultLimit = 20, maximumLimit = 100) {
  return {
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(maximumLimit).default(defaultLimit),
  };
}
