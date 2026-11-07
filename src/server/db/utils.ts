import { count, eq, getTableColumns, type InferSelectModel, type SQL } from 'drizzle-orm'
import type { AnyPgTable, PgColumn } from 'drizzle-orm/pg-core'
import { db } from '@/server/db'

export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0]
export type DbOrTransaction = Transaction | typeof db

/**
 * Selects the first row from a query result, or null when it is empty; it does not
 * verify that the result contains at most one row.
 * @param values - Rows returned by a database lookup.
 * @returns The first row or null.
 */
export const takeUniqueOrNull = takeUniqueOr(() => null)

type TableId<TTable extends AnyPgTable<{ columns: { id: PgColumn } }>> =
  TTable['_']['columns']['id']['_']['data']

/**
 * Creates a query-result handler for lookups expected to return at most one row.
 * It selects the first result and does not check whether additional rows exist.
 * @param or - Invoked on an empty result; may return a fallback or throw.
 * @returns A function mapping a result array to its first row or the fallback.
 */
export function takeUniqueOr<E = never>(
  or: () => E,
): <T extends any[]>(values: T) => [E] extends [never] ? T[number] : E | T[number] {
  return (values) => {
    if (values.length === 0) return or()
    // oxlint-disable-next-line typescript/no-unsafe-return
    return values[0]
  }
}

/**
 * Counts matching rows and retrieves one page by first selecting ordered IDs.
 * Used for file listings to avoid applying offset to full joined rows. The optional
 * fetch callback hydrates IDs inside the transaction; its result is reordered to
 * match the ID page and missing IDs are omitted.
 * @param options - Table and optional filter, stable order, 1-based page, requested
 * size, optional size bounds and optional ID-based item fetcher.
 * @returns Items, total count, effective size and page, and at least one total page.
 */
export async function paginated<
  TTable extends AnyPgTable<{ columns: { id: PgColumn } }>,
  TItem extends { id: TableId<TTable> } = InferSelectModel<TTable>,
>(options: {
  table: TTable
  where: SQL | undefined
  orderBy: (PgColumn | SQL | SQL.Aliased) | (PgColumn | SQL | SQL.Aliased)[]
  page: number
  size: number
  minSize?: number
  maxSize?: number
  getItems?: (tx: Transaction, ids: TableId<TTable>[]) => Promise<TItem[]>
}): Promise<{
  items: TItem[]
  total: number
  size: number
  page: number
  totalPages: number
}> {
  const idColumn = getTableColumns(options.table).id
  const table = options.table as AnyPgTable
  const orderBy = Array.isArray(options.orderBy) ? options.orderBy : [options.orderBy]
  const size = Math.min(
    options.maxSize ?? options.size,
    Math.max(options.minSize ?? 1, options.size),
  )

  return db.transaction(async (tx) => {
    const totalQuery = tx.select({ total: count() }).from(table).where(options.where)
    const [total] = await totalQuery
    const totalPages = Math.ceil(total.total / size)
    const page = Math.min(options.page, Math.max(totalPages, 1))

    let items: TItem[]
    if (options.getItems) {
      const pageIds = await tx
        .select({ id: idColumn })
        .from(table)
        .where(options.where)
        .orderBy(...orderBy)
        .limit(size)
        .offset((page - 1) * size)

      const fetchedItems = await options.getItems(
        tx,
        pageIds.map((row) => row.id),
      )
      const itemsById = new Map(fetchedItems.map((item) => [item.id, item]))
      items = pageIds.flatMap(({ id }) => {
        const item = itemsById.get(id)
        return item ? [item] : []
      })
    } else {
      const subquery = tx
        .select({ id: idColumn })
        .from(table)
        .where(options.where)
        .orderBy(...orderBy)
        .limit(size)
        .offset((page - 1) * size)
        .as('subquery')

      const rows = await tx
        .select({ row: options.table })
        .from(table)
        .innerJoin(subquery, eq(idColumn, subquery.id))
        .orderBy(...orderBy)

      items = rows.map((entry) => entry.row)
    }

    return {
      items,
      total: total.total,
      size,
      page,
      totalPages: Math.max(1, Math.ceil(total.total / size)),
    }
  })
}
