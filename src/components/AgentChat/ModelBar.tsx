import React, { useEffect, useState } from 'react';
import { agentClient, AgentModel } from '../../services/agentClient';

interface ModelBarProps {
  model: string; // '' = server default
  onChangeModel: (model: string) => void;
  isStreaming: boolean;
}

const CUSTOM = '__custom__';

/** Model switcher: every model opencode can use, grouped by provider, free ones first. */
export const ModelBar: React.FC<ModelBarProps> = ({ model, onChangeModel, isStreaming }) => {
  const [models, setModels] = useState<AgentModel[]>([]);
  const [defaultModel, setDefaultModel] = useState('');
  const selected = model || defaultModel;
  const info = models.find((m) => m.id === selected);

  useEffect(() => {
    agentClient.listModels().then(({ default: d, models }) => {
      setDefaultModel(d);
      setModels(models);
    });
  }, []);

  // Paid models need credits with that provider; free ones work with just an opencode login.
  const groups: [string, AgentModel[]][] = [];
  for (const m of models.filter((m) => m.id !== defaultModel)) {
    const label = `${m.ownedBy} · ${m.free ? 'free' : 'paid'}`;
    const group = groups.find(([l]) => l === label) ?? (groups.push([label, []]), groups[groups.length - 1]!);
    group[1].push(m);
  }

  return (
    <div className="flex items-center gap-2 min-w-0">
      <select
        value={model}
        onChange={(e) => {
          if (e.target.value !== CUSTOM) return onChangeModel(e.target.value);
          const id = window.prompt('opencode model id (provider/model, see `opencode models`):', model)?.trim();
          if (id) onChangeModel(id);
        }}
        disabled={isStreaming}
        title="Model used for the next message"
        className="h-5 max-w-[220px] bg-[#16171d] border border-[#272935] rounded px-1 text-[10.5px] text-neutral-300 focus:outline-none focus:border-blue-500 disabled:opacity-50"
      >
        <option value="">{defaultModel ? `${defaultModel} (default)` : 'default'}</option>
        {groups.map(([label, list]) => (
          <optgroup key={label} label={label}>
            {list.map((m) => (
              <option key={m.id} value={m.id}>
                {m.id}
              </option>
            ))}
          </optgroup>
        ))}
        {model && !models.some((m) => m.id === model) && <option value={model}>{model}</option>}
        <option value={CUSTOM}>Custom model id…</option>
      </select>
      {info && (
        <span className="text-[10px] text-neutral-500 whitespace-nowrap">
          {info.free ? 'free' : 'paid'}
          {info.contextWindow ? ` · ${Math.round(info.contextWindow / 1000)}k ctx` : ''}
        </span>
      )}
    </div>
  );
};
