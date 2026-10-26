import BankCard from '@/components/BankCard';
import HeaderBox from '@/components/HeaderBox'
import { getAccounts } from '@/lib/actions/bank.actions';
import { getLoggedInUser } from '@/lib/actions/user.actions';
import React from 'react'

const MyBanks = async () => {
  const loggedIn = await getLoggedInUser();

  if(!loggedIn) return null;

  const accounts = await getAccounts({ 
    userId: loggedIn.$id || loggedIn.userId 
  })

  return (
    <section className='flex flex-1 min-w-0 h-full overflow-hidden'>
      <div className="my-banks">
        <HeaderBox 
          title="My Bank Accounts"
          subtext="Effortlessly manage your banking activites."
        />

        <div className="space-y-4">
          <h2 className="header-2">
            Your cards
          </h2>
          <div className="flex flex-wrap gap-6">
            {accounts && accounts.data.length > 0 ? (
              accounts.data.map((a: Account) => (
                <BankCard 
                  key={a.id || a.appwriteItemId}
                  account={a}
                  userName={loggedIn?.firstName || loggedIn?.name || 'User'}
                />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center p-8 bg-gray-25 rounded-lg border border-dashed border-gray-200 w-full">
                <p className="text-14 font-medium text-gray-500">
                  No bank accounts added yet. Link a bank account to view your cards.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

export default MyBanks