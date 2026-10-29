# composerkit

composerkit is a set of React components for chat apps. It has a message box, called the composer, and a conversation view that shows the chat above the composer. It also has the buttons, menus and tooltips that the composer and the conversation use. The components are built on [Base UI](https://base-ui.com) and styled with Tailwind CSS v4.

![A short chat in the conversation view, with a draft in the composer at the bottom](https://raw.githubusercontent.com/bjoernaagaard/ComposerKit/main/.github/assets/conversation.png)

The docs site has a live example, the API and the keyboard support for each component, at <https://bjoernaagaard.github.io/ComposerKit/>. The same components are also a shadcn registry, so you can copy the source into your app instead of installing the package. The [GitHub repository](https://github.com/bjoernaagaard/ComposerKit) explains both options.

## Install

Your app needs React 19 and Tailwind CSS v4. Install the package, and then import its stylesheet after Tailwind in your main CSS file.

```bash
npm install composerkit
```

```css
@import "tailwindcss";
@import "composerkit/styles.css";
```

The stylesheet adds the ComposerKit theme in light and dark, and it tells Tailwind to scan the components for the classes they use. Without the import, the components render with no styles.

## Import paths

The package has no main entry. Each component is its own module, so you import it by its path, and your bundler only includes the modules you use.

```text
composerkit/
├── styles.css                                   # the theme and the Tailwind setup
├── components/composer/composer                 # Composer, the message box
├── components/composer/machine                  # the composer state, its actions and the reducer
├── components/composer/use-composer-controller  # useComposerController, which runs the composer
├── components/composer/options                  # the types for the model, effort and permission menus
├── components/conversation/conversation-view    # ConversationView, an open chat with the composer
├── components/conversation/types                # Turn, Block and toBlocks
├── components/ui/button                         # Button and buttonVariants
├── components/ui/icon-button                    # IconButton, a button with a tip
├── components/ui/menu                           # the menu parts
├── components/ui/tip                            # Tip and TipProvider
└── lib/utils                                    # cn, which joins class names
```

The docs examples use the shadcn import paths. Each module in the package has the same path as its source file, so you can change an import from the docs by replacing `@/` with `composerkit/`.

```diff
-import { Composer } from "@/components/composer/composer";
+import { Composer } from "composerkit/components/composer/composer";
```

## Show a conversation

The conversation view needs the first turns of the chat, the choices for the composer's menus, and a `reply` function. When someone sends a message, the view calls `reply` and shows the answer a few characters at a time.

```tsx
import type { ComposerOptions } from "composerkit/components/composer/options";
import { ConversationView } from "composerkit/components/conversation/conversation-view";
import { toBlocks } from "composerkit/components/conversation/types";
import type { Turn } from "composerkit/components/conversation/types";

const options: ComposerOptions = {
  efforts: [{ id: "normal", label: "Normal" }],
  models: [{ id: "fast", label: "Fast" }],
  permissions: [{ id: "ask", label: "Ask first" }],
};

const turns: Turn[] = [
  {
    attachments: [],
    blocks: toBlocks([
      { kind: "paragraph", text: "What does ComposerKit draw?" },
    ]),
    id: "t1",
    role: "user",
  },
  {
    attachments: [],
    blocks: toBlocks([
      { kind: "paragraph", text: "A message box and the chat above it." },
    ]),
    id: "t2",
    role: "assistant",
  },
];

export const App = () => (
  <div className="bg-background text-foreground h-screen">
    <ConversationView
      options={options}
      projects={[]}
      reply={() => [{ kind: "paragraph", text: "Thanks. Here is a reply." }]}
      title="Help chat"
      turns={turns}
    />
  </div>
);
```

The conversation view fills its container, so give the container a height. The `bg-background` and `text-foreground` classes give the page the theme's colors.

## Use the composer on its own

The composer draws a state that your component owns. The `useComposerController` hook keeps the state in a reducer, and it gives the composer handlers for sending, uploads and dictation. When someone sends a message, the hook calls your function with the state that was sent, and then it clears the draft.

```tsx
import { Composer } from "composerkit/components/composer/composer";
import { initialComposer } from "composerkit/components/composer/machine";
import type { ComposerOptions } from "composerkit/components/composer/options";
import { useComposerController } from "composerkit/components/composer/use-composer-controller";

const options: ComposerOptions = {
  efforts: [{ id: "normal", label: "Normal" }],
  models: [{ id: "fast", label: "Fast" }],
  permissions: [{ id: "ask", label: "Ask first" }],
};

export const MessageBox = ({ onSend }: { onSend: (text: string) => void }) => {
  const composer = useComposerController(
    (sent) => onSend(sent.draft),
    initialComposer(options)
  );

  return (
    <Composer
      dispatch={composer.dispatch}
      handlers={composer.handlers}
      mode="chat"
      options={options}
      projects={[]}
      state={composer.state}
    />
  );
};
```

The hook doesn't upload files to a server. It moves each file's progress bar on a timer, so you can see the upload states. To upload files for real, write your own `ComposerHandlers` and dispatch the actions from `composerkit/components/composer/machine` as your upload runs.

## Dark theme and your own colors

The theme is a set of CSS variables, with light values on `:root` and dark values on `.dark`. Add the `dark` class to an element, such as `<html>`, to show the dark theme inside it.

To change a color or a size, set its variable after the import. Put the rule outside any `@layer`, so it comes after the theme in the cascade.

```css
@import "tailwindcss";
@import "composerkit/styles.css";

:root {
  --primary: #0a7d4f;
}

.dark {
  --primary: #5fd3a0;
}
```

The [theme page](https://bjoernaagaard.github.io/ComposerKit/theme/) in the docs lists every variable, and each component page lists the variables that the component uses.

## Next.js and React Server Components

Every module in the package starts with the `"use client"` directive, so Next.js loads the components on the client. A server component can't pass a function prop, such as `reply`, to a client component. Render the conversation view and the composer from a file that starts with `"use client"`.

## License

MIT
