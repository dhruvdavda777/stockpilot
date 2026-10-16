// Shows which build is running and the path it took to get here. The version
// is the Git commit SHA, injected at image build time (VITE_APP_VERSION).
const VERSION = import.meta.env.VITE_APP_VERSION || 'local'
const ENVIRONMENT = import.meta.env.VITE_APP_ENV || 'development'

const STAGES = ['Test', 'Build', 'Scan', 'Push', 'Deploy']

export default function PipelineStatus({ apiOnline }) {
  const shortSha = VERSION.length > 12 ? VERSION.slice(0, 7) : VERSION
  return (
    <div className="pipeline">
      <div className="pipeline__head">
        <span>Delivery pipeline</span>
        <span className={`env-chip env-chip--${ENVIRONMENT}`}>{ENVIRONMENT}</span>
      </div>
      <ol className="pipeline__stages" aria-label="CI/CD stages">
        {STAGES.map((stage) => (
          <li key={stage} className="pipeline__stage" title={`${stage} passed`}>
            <span className="pipeline__dot" />
            {stage}
          </li>
        ))}
      </ol>
      <div className="pipeline__meta">
        <code title={VERSION}>build {shortSha}</code>
        <span className={`api-status ${apiOnline ? 'is-online' : 'is-offline'}`}>
          <span className="api-status__dot" />
          API {apiOnline ? 'online' : 'offline'}
        </span>
      </div>
    </div>
  )
}
