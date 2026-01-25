interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
  batakPreview: string;
}

export function TextInput({ value, onChange, batakPreview }: TextInputProps) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          Input Text (Latin or Batak)
        </label>
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="tuak batak"
          className="w-full h-24 px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg
                     text-white placeholder-slate-500 focus:outline-none focus:ring-2
                     focus:ring-blue-500 focus:border-transparent resize-none font-mono"
        />
      </div>
      {batakPreview && (
        <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
          <div className="text-xs text-slate-400 mb-1">Batak Script Preview</div>
          <div className="text-3xl text-white font-normal tracking-wide">
            {batakPreview}
          </div>
        </div>
      )}
    </div>
  );
}
