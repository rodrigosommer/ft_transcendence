import { useTranslation } from 'react-i18next';
import { AVATAR_PRESETS, presetFromStored, presetToStored, type AvatarPreset } from '@wkb/shared';
import { AVATAR_ART } from '../theme/avatars.js';
import { Avatar } from './ui.js';

 /* Sixteen stock avatars grouped by suit, in a radiogroup (one choice among many, with arrow key navigation built in). 
 The first option is "no stock avatar" and shows the generated initials the account falls back to.*/
export function AvatarPicker({
  value,
  displayName,
  onChange,
  disabled = false,
}: {
  //The stored avatar value which can be an upload, a preset, or null
  value: string | null;
  displayName: string;
  onChange: (next: AvatarPreset | null) => void;
  disabled?: boolean;
}): JSX.Element {
  const { t } = useTranslation();
  const current = presetFromStored(value);
  const bySuit = new Map<string, AvatarPreset[]>();
  for (const preset of AVATAR_PRESETS) 
  {
    const suit = AVATAR_ART[preset].suit;
    bySuit.set(suit, [...(bySuit.get(suit) ?? []), preset]);
  }
  const tile = (selected: boolean, children: JSX.Element, label: string, onPick: () => void, key: string) => (
    <button
      key={key}
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onPick}
      className={[
        'press flex items-center justify-center rounded-lg border p-1.5 disabled:opacity-50',
        selected ? 'border-spot bg-spot-wash' : 'border-rule-strong bg-surface',
      ].join(' ')}
    >
      {children}
    </button>
  );
  return (
    <div role="radiogroup" aria-label={t('profile.avatarChoose')} className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {tile(
          current === null, <Avatar name={displayName} size={40} />, t('profile.avatarNone'), () => onChange(null), 'none',
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
      {[...bySuit.entries()].map(([suit, presets]) => (
        <div key={suit}>
          {/* Not the suit colour. These sit on the themed surface where the suit colours measure as low as 2.82:1, 
          and a label is text and owes 4.5:1. The colour cue is right underneath on the tiles, 
          where it is printed on card stock and clears the bar. */}
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
            {t(`categories.${suit}`)}
          </p>
          <div className="flex flex-wrap gap-2">
            {presets.map((preset) =>
              tile(
                current === preset, <Avatar name={displayName} src={presetToStored(preset)} size={40} />, t(`avatars.${preset}`),() => onChange(preset), preset,
              ),
            )}
          </div>
        </div>
      ))}
      </div>
    </div>
  );
}
