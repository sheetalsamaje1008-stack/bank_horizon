import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { transactionCategoryStyles } from "@/constants"
import { cn, formatAmount, formatDateTime, getTransactionStatus, removeSpecialCharacters } from "@/lib/utils"

const CategoryBadge = ({ category }: CategoryBadgeProps) => {
  const {
    borderColor,
    backgroundColor,
    textColor,
    chipBackgroundColor,
   } = transactionCategoryStyles[category as keyof typeof transactionCategoryStyles] || transactionCategoryStyles.default
   
  return (
    <div className={cn('category-badge', borderColor, chipBackgroundColor)}>
      <div className={cn('size-2 rounded-full', backgroundColor)} />
      <p className={cn('text-[12px] font-medium', textColor)}>{category}</p>
    </div>
  )
} 

const TransactionsTable = ({ transactions }: TransactionTableProps) => {
  return (
    <Table>
      <TableHeader className="bg-[#f9fafb]">
        <TableRow>
          <TableHead className="px-2 lg:px-4">Transaction</TableHead>
          <TableHead className="px-2 lg:px-4">Amount</TableHead>
          <TableHead className="px-2 lg:px-4">Status</TableHead>
          <TableHead className="px-2 lg:px-4">Date</TableHead>
          <TableHead className="px-2 lg:px-4 max-md:hidden">Channel</TableHead>
          <TableHead className="px-2 lg:px-4 max-md:hidden">Category</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {transactions.map((t: Transaction) => {
          const status = getTransactionStatus(new Date(t.date))
          const amount = formatAmount(t.amount)

          const isDebit = t.type === 'debit';
          const isCredit = t.type === 'credit';

          return (
            <TableRow key={t.id} className={`${isDebit || amount[0] === '-' ? 'bg-[#FFFBFA]' : 'bg-[#F6FEF9]'} !over:bg-none !border-b-DEFAULT`}>
              <TableCell className="max-w-[180px] xl:max-w-[240px] px-2 lg:px-4">
                <div className="flex items-center gap-3">
                  <h1 className="text-14 truncate font-semibold text-[#344054]">
                    {removeSpecialCharacters(t.name)}
                  </h1>
                </div>
              </TableCell>

              <TableCell className={`px-2 lg:px-4 font-semibold whitespace-nowrap ${
                isDebit || amount[0] === '-' ?
                  'text-[#f04438]'
                  : 'text-[#039855]'
              }`}>
                {isDebit ? `-${amount}` : isCredit ? amount : amount}
              </TableCell>

              <TableCell className="px-2 lg:px-4 whitespace-nowrap">
                <CategoryBadge category={status} /> 
              </TableCell>

              <TableCell className="px-2 lg:px-4 whitespace-nowrap text-12 text-[#475467]">
                {formatDateTime(new Date(t.date)).dateTime}
              </TableCell>

              <TableCell className="px-2 lg:px-4 capitalize whitespace-nowrap">
               {t.paymentChannel}
              </TableCell>

              <TableCell className="px-2 lg:px-4 max-md:hidden whitespace-nowrap">
               <CategoryBadge category={t.category} /> 
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

export default TransactionsTable