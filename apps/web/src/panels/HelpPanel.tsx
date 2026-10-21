import { helpSections } from '@geomira/editor/keymap';

/** Keyboard shortcuts and tools, generated from the editor's keymap (SPEC §15, E10). */
export function HelpPanel() {
  return (
    <div className="help">
      {helpSections().map((s) => (
        <section key={s.title}>
          <h3>{s.title}</h3>
          <table>
            <tbody>
              {s.rows.map((r) => (
                <tr key={`${r.keys}:${r.help}`}>
                  <td>
                    <kbd>{r.keys}</kbd>
                  </td>
                  <td>{r.help}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
      <p className="muted">
        Type statements of the language in the command bar or the text panel; see the language
        reference for every tool.
      </p>
    </div>
  );
}
