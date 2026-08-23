import { useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { useRunes } from '../hooks/useRunes';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { runeIconUrl } from '../api/dataDragon';
import { toPlainText } from '../utils/richText';
import type { DDragonRune } from '../types/ddragon';

interface Selected {
  treeId: number;
  rune: DDragonRune;
}

function RuneIcon({
  rune, size, selected, onSelect,
}: {
  rune: DDragonRune;
  size: 'lg' | 'sm';
  selected: boolean;
  onSelect: () => void;
}) {
  const dim = size === 'lg' ? 'w-11 h-11' : 'w-8 h-8';
  return (
    <button
      onClick={onSelect}
      title={rune.name}
      aria-pressed={selected}
      className={`${dim} rounded-full p-1 border transition-colors flex-shrink-0 ${
        selected
          ? 'border-primary bg-primary/10'
          : 'border-transparent hover:border-border hover:bg-card'
      }`}
    >
      <img src={runeIconUrl(rune.icon)} alt={rune.name} className="w-full h-full object-contain" loading="lazy" />
    </button>
  );
}

export function Runes() {
  useDocumentTitle('ルーン一覧 | nunune');
  const { trees, loading, error } = useRunes();
  const [selected, setSelected] = useState<Selected | null>(null);

  function toggle(treeId: number, rune: DDragonRune) {
    setSelected(prev => (prev?.rune.id === rune.id ? null : { treeId, rune }));
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border">
        <div className="container mx-auto px-4 py-2.5 max-w-6xl">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={15} />
            戻る
          </Link>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-1">ルーン</h1>
        <p className="text-xs text-muted-foreground mb-6">
          アイコンをタップすると効果が表示されます。
        </p>

        {loading ? (
          <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
            <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            <p className="text-xs tracking-widest uppercase">Loading...</p>
          </div>
        ) : error ? (
          <p className="text-sm text-muted-foreground text-center py-16">エラー: {error.message}</p>
        ) : (
          <div className="flex flex-col lg:flex-row lg:items-start gap-4">
            {trees.map(tree => (
              <div key={tree.id} className="lg:flex-1 lg:min-w-0 bg-card border border-border rounded-md p-3">
                <div className="flex items-center gap-2 mb-3">
                  <img src={runeIconUrl(tree.icon)} alt="" className="w-6 h-6 object-contain" />
                  <span className="text-sm font-bold text-foreground">{tree.name}</span>
                </div>

                <div className="flex flex-col gap-3">
                  {tree.slots.map((slot, slotIdx) => (
                    <div key={slotIdx} className="flex flex-wrap gap-2">
                      {slot.runes.map(rune => (
                        <RuneIcon
                          key={rune.id}
                          rune={rune}
                          size={slotIdx === 0 ? 'lg' : 'sm'}
                          selected={selected?.rune.id === rune.id}
                          onSelect={() => toggle(tree.id, rune)}
                        />
                      ))}
                    </div>
                  ))}
                </div>

                {selected && selected.treeId === tree.id && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-sm font-bold text-foreground mb-1">{selected.rune.name}</p>
                    <p className="text-[13px] text-muted-foreground leading-relaxed">
                      {toPlainText(selected.rune.longDesc || selected.rune.shortDesc)}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
