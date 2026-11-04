import { count, eq, getTableColumns, type InferSelectModel, type SQL, sql } from 'drizzle-orm'
import type { AnyPgTable, PgColumn, PgTable } from 'drizzle-orm/pg-core'
import { db } from '@/server/db'

export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0]
export type DbOrTransaction = Transaction | typeof db

export const takeUniqueOrNull = takeUniqueOr(() => null)

type TableId<TTable extends AnyPgTable<{ columns: { id: PgColumn } }>> =
  TTable['_']['columns']['id']['_']['data']

export function takeUniqueOr<E = never>(
  or: () => E,
): <T extends any[]>(values: T) => [E] extends [never] ? T[number] : E | T[number] {
  return (values) => {
    if (values.length === 0) return or()
    // oxlint-disable-next-line typescript/no-unsafe-return
    return values[0]
  }
}

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

export function buildConflictUpdateColumns<T extends PgTable, Q extends keyof T['_']['columns']>(
  table: T,
  columns: Q[],
) {
  const tableColumns = getTableColumns(table)
  return columns.reduce(
    (acc, column) => {
      const colName = tableColumns[column].name
      acc[column] = sql.raw(`excluded.${colName}`)
      return acc
    },
    {} as Record<Q, SQL>,
  )
}
