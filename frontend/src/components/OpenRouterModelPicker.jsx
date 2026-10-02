import { useId, useState } from 'react'

// Cheap models differ in the third and fourth decimal ($0.0198 against
// $0.0099), so show cents for prices of $1 or more and 4 significant digits below.
function dollars(value) {
  const number = Number(value)
  if (number >= 1) return `$${number.toFixed(2)}`
  return `$${Number(number.toPrecision(4))}`
}

function price(model) {
  if (model.free) return 'Free'
  if (model.prompt_per_million == null || model.completion_per_million == null)
    return 'Price unknown'
  return `${dollars(model.prompt_per_million)} / ${dollars(model.completion_per_million)} per 1M`
}

function ModelDetails({ model }) {
  return (
    <span className="block">
      <span className="block font-medium">{model.name || model.id}</span>
      <span className="block text-xs font-mono">{model.id}</span>
      <span className="block text-sm">{price(model)}</span>
      {model.context_length != null && (
        <span className="block text-sm">
          {Number(model.context_length).toLocaleString('en-US')} tokens
        </span>
      )}
    </span>
  )
}

export default function OpenRouterModelPicker({
  selectedModel,
  onModelChange,
  catalog,
  onReload,
  label = 'OpenRouter models',
}) {
  const id = useId()
  const [search, setSearch] = useState('')
  const [freeOnly, setFreeOnly] = useState(false)
  const [sort, setSort] = useState('price')
  const [limit, setLimit] = useState(50)
  const models = catalog.models || []
  const selected = models.find(model => model.id === selectedModel)
  const query = search.toLowerCase()
  const matches = models
    .filter(
      model =>
        (!freeOnly || model.free) && `${model.id} ${model.name}`.toLowerCase().includes(query)
    )
    .sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name) || a.id.localeCompare(b.id)
      if (sort === 'context')
        return (b.context_length || 0) - (a.context_length || 0) || a.id.localeCompare(b.id)
      if (a.free !== b.free) return a.free ? -1 : 1
      const aPrice = a.prompt_per_million == null ? Infinity : Number(a.prompt_per_million)
      const bPrice = b.prompt_per_million == null ? Infinity : Number(b.prompt_per_million)
      return aPrice - bPrice || a.id.localeCompare(b.id)
    })

  return (
    <div className="space-y-3">
      {selectedModel && (
        <div
          aria-label="Selected model"
          className="p-3 border rounded-lg bg-primary-50 dark:bg-gray-900"
        >
          <p className="font-bold">Selected model</p>
          {selected ? (
            <ModelDetails model={selected} />
          ) : (
            <>
              <p className="font-mono text-sm">{selectedModel}</p>
              <p>Not in the current catalog</p>
            </>
          )}
        </div>
      )}
      {catalog.loading ? (
        <p role="status">Loading models...</p>
      ) : catalog.error ? (
        <div role="alert">
          <p>{catalog.error}</p>
          <button className="btn-secondary" onClick={() => onReload()}>Retry</button>
        </div>
      ) : (
        <>
          {catalog.stale && <p>Showing a cached list; OpenRouter could not be reached.</p>}
          <label htmlFor={`${id}-search`}>Search models</label>
          <input
            id={`${id}-search`}
            type="search"
            value={search}
            onChange={event => {
              setSearch(event.target.value)
              setLimit(50)
            }}
            className="w-full p-2 border rounded-lg bg-white dark:bg-gray-900"
          />
          <label className="block">
            <input
              type="checkbox"
              checked={freeOnly}
              onChange={event => {
                setFreeOnly(event.target.checked)
                setLimit(50)
              }}
            />{' '}
            Free only
          </label>
          <label htmlFor={`${id}-sort`}>Sort models</label>
          <select
            id={`${id}-sort`}
            value={sort}
            onChange={event => {
              setSort(event.target.value)
              setLimit(50)
            }}
            className="p-2 border rounded-lg bg-white dark:bg-gray-900"
          >
            <option value="price">Price</option>
            <option value="name">Name</option>
            <option value="context">Context</option>
          </select>
          <button onClick={() => onReload(true)} className="ml-3">
            Refresh
          </button>
          <div role="radiogroup" aria-label={label} className="max-h-96 overflow-y-auto space-y-2">
            {matches.slice(0, limit).map(model => (
              <label key={model.id} className="flex gap-3 p-3 border rounded-lg cursor-pointer">
                <input
                  type="radio"
                  name={id}
                  value={model.id}
                  checked={model.id === selectedModel}
                  onChange={() => onModelChange(model.id)}
                />
                <ModelDetails model={model} />
              </label>
            ))}
          </div>
          {matches.length === 0 && <p>No matching models</p>}
          {matches.length > limit && (
            <button onClick={() => setLimit(value => value + 50)}>Show more</button>
          )}
        </>
      )}
    </div>
  )
}
