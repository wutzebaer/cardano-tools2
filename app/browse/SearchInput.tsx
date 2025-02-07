'use client';

import { MagnifyingGlassIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { useParams, useRouter } from 'next/navigation';
import { ChangeEvent, KeyboardEvent, useState, useTransition } from 'react';

const SearchInput: React.FC = () => {
    const router = useRouter();
    const { query } = useParams<{ query: string }>();
    const [searchTerm, setSearchTerm] = useState<string>(query);
    const [, startTransition] = useTransition();

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            startTransition(() => {
                router.replace(`/browse/${searchTerm}`);
            });
        }
    };

    const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
    };

    const handleClear = () => {
        setSearchTerm('');
    };

    return (
        <label className="input input-bordered flex items-center gap-2 w-full max-w-xl">
            <input
                type="text"
                value={searchTerm}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="PolicyId or Fingerprint..."
                className="grow"
            />
            {searchTerm ? (
                <button onClick={handleClear}>
                    <XCircleIcon className='h-6 w-6' />
                </button>
            ) : (
                <MagnifyingGlassIcon className='h-6 w-6 opacity-70' />
            )}
        </label>
    );
};

export default SearchInput;
