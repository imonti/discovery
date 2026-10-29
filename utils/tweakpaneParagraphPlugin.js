import {
  BladeApi,
  BladeController,
  ClassName,
  createPlugin,
  parseRecord,
} from "@tweakpane/core";

const className = ClassName("paragraph");

class ParagraphView {
  constructor(document, { text, viewProps }) {
    this.element = document.createElement("div");
    this.element.classList.add(className());
    this.element.textContent = text;
    viewProps.bindClassModifiers(this.element);
  }
}

class ParagraphController extends BladeController {
  constructor(document, { blade, text, viewProps }) {
    super({
      blade,
      view: new ParagraphView(document, { text, viewProps }),
      viewProps,
    });
  }
}

const paragraphBladePlugin = createPlugin({
  id: "paragraph",
  type: "blade",

  accept(params) {
    const result = parseRecord(params, (parser) => ({
      text: parser.required.string,
      view: parser.required.constant("paragraph"),
    }));

    return result ? { params: result } : null;
  },

  controller(args) {
    return new ParagraphController(args.document, {
      blade: args.blade,
      text: args.params.text,
      viewProps: args.viewProps,
    });
  },

  api({ controller }) {
    return controller instanceof ParagraphController
      ? new BladeApi(controller)
      : null;
  },
});

export const paragraphPlugin = {
  id: "paragraph",
  css: `
    .${className()} {
      box-sizing: border-box;
      color: var(--tp-label-foreground-color, rgba(187, 188, 196, 0.7));
      font-size: 11px;
      font-weight: 400;
      line-height: 1.45;
      overflow-wrap: anywhere;
      padding: 6px 8px 8px;
      white-space: pre-line;
    }
  `,
  plugins: [paragraphBladePlugin],
};
