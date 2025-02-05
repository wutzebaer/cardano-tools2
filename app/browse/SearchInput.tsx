'use client';

import { MagnifyingGlassIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition, useEffect, ChangeEvent } from 'react';

const SearchInput: React.FC = () => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [, startTransition] = useTransition();

    useEffect(() => {
        const initialQuery = searchParams.get('query') ?? '';
        setSearchTerm(initialQuery);
    }, [searchParams]);

    const updateSearchParams = (value: string) => {
        setSearchTerm(value);
        const params = new URLSearchParams(searchParams.toString());
        if (value) {
            params.set('query', value);
        } else {
            params.delete('query');
        }
        startTransition(() => {
            router.replace(`?${params.toString()}`);
        });
    };

    const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
        updateSearchParams(e.target.value);
    };

    const handleClear = () => {
        updateSearchParams('');
    };

    return (
        <label className="input input-bordered flex items-center gap-2 w-full max-w-xl">
            <input
                type="text"
                value={searchTerm}
                onChange={handleInputChange}
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
