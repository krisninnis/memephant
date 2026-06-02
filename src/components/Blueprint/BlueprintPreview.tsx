import type { ProjectBlueprint } from '../../types/memphant-types';
import { projectBlueprintToMarkdown } from '../../utils/projectBlueprintGenerator';

interface BlueprintPreviewProps {
  blueprint: ProjectBlueprint;
  onCopy?: (markdown: string) => void;
}

function list(items: string[]) {
  return (
    <ul>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export function BlueprintPreview({ blueprint, onCopy }: BlueprintPreviewProps) {
  const markdown = projectBlueprintToMarkdown(blueprint);

  return (
    <div className="blueprint-preview">
      <div className="blueprint-preview__header">
        <div>
          <h3>Blueprint Preview</h3>
          <p>Review the context Memephant will save before any code exists.</p>
        </div>

        {onCopy && (
          <button type="button" className="blueprint-secondary" onClick={() => onCopy(markdown)}>
            Copy Markdown
          </button>
        )}
      </div>

      <section className="blueprint-preview__section">
        <h4>Project Summary</h4>
        <p><strong>Vision:</strong> {blueprint.projectSummary.vision}</p>
        <p><strong>Purpose:</strong> {blueprint.projectSummary.purpose}</p>
        <p><strong>Target users:</strong> {blueprint.projectSummary.targetUsers}</p>
      </section>

      <section className="blueprint-preview__grid">
        <div>
          <h4>MVP Scope</h4>
          {list(blueprint.productDefinition.mvpScope)}
        </div>
        <div>
          <h4>First Tasks</h4>
          <ol>
            {blueprint.firstTenTasks.slice(0, 5).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </div>
      </section>

      <section className="blueprint-preview__section">
        <h4>Recommended Stack</h4>
        {list(blueprint.recommendedStack)}
      </section>

      <section className="blueprint-preview__section">
        <h4>Context Passport Seed</h4>
        <pre>{blueprint.contextPassportSeed}</pre>
      </section>
    </div>
  );
}

export default BlueprintPreview;
