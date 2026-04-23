import { useEffect, useRef } from 'react';
import { Search } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (query: string) => void;
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  return (
    <div className="relative w-full max-w-2xl">
      <Search
        size={18}
        className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
      />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="チャンピオン・アイテムを検索..."
        className="w-full bg-card border border-border py-3 pl-11 pr-4 text-sm text-foreground
          placeholder:text-muted-foreground/60
          focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20
          transition-colors duration-150"
        aria-label="チャンピオン・アイテムを検索"
      />
    </div>
  );
}
