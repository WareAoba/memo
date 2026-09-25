# Global feature styles

`../styles.css` loads these files in the order below. Each declares `@layer features`.
The split preserves the original declaration order, including repeated selectors and media rules.
Do not sort the imports or deduplicate selectors without checking the resulting cascade.

| File                  | Ownership                                                              |
| --------------------- | ---------------------------------------------------------------------- |
| `base.css`            | Document defaults, shared lists, forms, details, initial mobile layout |
| `workspace.css`       | Navigation, day summary, work/task cards, calendar foundations         |
| `appearance.css`      | Shared navigation, typography and card appearance refinements          |
| `preset-forms.css`    | Checklist definitions, work-task editor, schedule form basics          |
| `theme.css`           | Feature surface and color refinements using shared tokens              |
| `execution.css`       | Execution field layouts                                                |
| `shell-calendar.css`  | Application grid, sidebar, Today shell and calendar responsive layout  |
| `today.css`           | Today completion list, progress and editable task cards                |
| `preset-modal.css`    | Compact preset lists and modal/schedule composition                    |
| `custom-details.css`  | Custom detail fields and kind picker                                   |
| `chrome.css`          | Text selection, scrollbars and tag input                               |
| `schedule-picker.css` | Search results, task group selection and schedule card flip            |

Shared control styles belong in `../design-system.css`; colors and dimensions belong in `../tokens.css`.
Feature-local styles already live beside schedules, search, customization and toast components.
Some earlier shared rules intentionally remain in workspace/appearance/theme to preserve precedence.
When editing a selector, search for all its definitions before choosing the owning file.

Validation: `npm run check:frontend` from the repository root.
