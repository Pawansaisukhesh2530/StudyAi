import type { DiagramData } from '../services/geminiService';

interface DiagramViewProps {
  data: DiagramData;
}

export default function DiagramView({ data }: DiagramViewProps) {
  if (data.type === 'concept') {
    return <ConceptMapView data={data} />;
  }
  return <FlowDiagramView data={data} />;
}

function FlowDiagramView({ data }: { data: DiagramData }) {
  return (
    <div className="diagram">
      <div className="diagram__title">{data.title}</div>
      <div className="diagram__flow">
        {data.nodes.map((node, idx) => {
          const hasEdge = data.edges.some(([from]) => from === node);
          return (
            <div key={node} className="diagram__flow-item">
              <div className="diagram__node" style={{ '--node-idx': idx } as React.CSSProperties}>
                {node}
              </div>
              {hasEdge && <div className="diagram__arrow">→</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ConceptMapView({ data }: { data: DiagramData }) {
  const center = data.center ?? data.nodes[0];
  const spokes = data.nodes.filter((n) => n !== center);

  return (
    <div className="diagram">
      <div className="diagram__title">{data.title}</div>
      <div className="diagram__concept">
        <div className="diagram__concept-center">
          <div className="diagram__node diagram__node--center">{center}</div>
        </div>
        <div className="diagram__concept-spokes">
          {spokes.map((node, idx) => (
            <div key={node} className="diagram__concept-spoke" style={{ '--spoke-idx': idx } as React.CSSProperties}>
              <div className="diagram__spoke-line" />
              <div className="diagram__node">{node}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
