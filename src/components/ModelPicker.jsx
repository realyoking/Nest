// Run 25: AI 助理 model picker — a small black-and-white chip above the composer; opens a sheet with 自動 + each free
// model and a one-line description. The choice is saved to the user's prefs (users/{uid}.prefs.aiModel).
import { useState } from 'react';
import Sheet from './Sheet.jsx';
import Icon from './Icon.jsx';
import ModelIcon from './ModelIcon.jsx';
import { useI18n } from '../lib/i18n.jsx';
import { useSession } from '../lib/session.jsx';
import { useToast } from './ui.jsx';
import { GROUPS, normModel, modelName, modelDesc, pickerText } from '../lib/ai-models.js';

export function useModelChoice() {
  const s = useSession();
  return normModel(s?.prefs?.aiModel);
}

export default function ModelPicker({ disabled }) {
  const { uiLang: lang } = useI18n(); // the real UI language (th / zh-Hans …), not the legacy two-way lang
  const s = useSession();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const cur = normModel(s?.prefs?.aiModel);
  const T = pickerText(lang);
  const pick = async (id) => {
    setOpen(false);
    if (id === cur) return;
    try { await s.savePrefs({ aiModel: id }); } catch { toast(/^zh/.test(lang) ? '未能儲存，請再試一次。' : 'Couldn’t save — try again.', 'err'); }
  };
  return (
    <>
      <button type="button" className="model-chip" onClick={() => setOpen(true)} disabled={disabled} aria-haspopup="dialog" aria-label={`${T.label} · ${T.current.replace('{name}', modelName(cur, lang))}`} data-testid="model-chip">
        <ModelIcon id={cur} size={14} />
        <span>{modelName(cur, lang)}</span>
        <Icon name="chevronDown" size={13} stroke={2.2} />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={T.title} label={T.label} className="model-sheet">
        <div className="model-list" role="listbox" aria-label={T.label}>
          {[{ key: 'auto', title: '', ids: ['auto'] }, ...GROUPS].filter((g) => g.ids.length).map((g) => (
            <div key={g.key} className="model-group" role="group" aria-label={g.title || T.auto}>
              {g.title ? <p className="model-group-h">{g.title}</p> : null}
              {g.ids.map((id) => (
                <button key={id} type="button" role="option" aria-selected={id === cur} className={`model-opt${id === cur ? ' on' : ''}`} onClick={() => pick(id)} data-testid={`model-opt-${id === 'auto' ? 'auto' : id.split('/').pop()}`}>
                  <span className="model-opt-ic" aria-hidden="true"><ModelIcon id={id} size={20} /></span>
                  <span className="model-opt-tx"><b>{modelName(id, lang)}</b><small>{modelDesc(id, lang)}</small></span>
                  <span className="model-opt-ck" aria-hidden="true">{id === cur ? <Icon name="check" size={18} stroke={2.4} /> : null}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
        <p className="model-note"><span className="model-free">{T.free}</span>{T.note}</p>
      </Sheet>
    </>
  );
}
