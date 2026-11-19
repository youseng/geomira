import { availableHelp } from '../available-tools';
import { AboutSection } from '../about';

/**
 * Keyboard shortcuts and tools, generated from the editor's keymap (SPEC §15, E10), and what
 * this copy is (its build, offline use, where tests run; Run 12).
 */
export function HelpPanel() {
  return (
    <div className="help">
      {availableHelp().map((s) => (
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
        reference for every tool. Right-click an object, on the canvas or in the Objects panel (or
        hold a finger on it), to change its style or its name. In the Move tool, drag a label to
        move it next to its object.
      </p>
      <p>
        Move: left-drag empty canvas to box-select; Shift adds to selection. Right or middle drag
        pans, and touch pans or pinches to zoom. Choose View → Pan canvas to pan over points. Escape
        cancels picks and 0 fits the figure. Select one object and choose Properties; right-click or
        long-press remains available. Press Ctrl+K (⌘K on Mac) to search tools by name.
      </p>
      <AboutSection />
    </div>
  );
}
