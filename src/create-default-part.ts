import {
  InlineValuePartType,
  partInput,
  partOutput,
  randomInt,
} from "@flyde/core";
import { inlineValuePart } from "@flyde/core";

export const createDefaultPart = (inputNames: string[]) => {
  const inputs = inputNames.reduce((prev, curr) => {
    return { ...prev, [curr]: partInput() };
  }, {});

  const outputs = {
    value: partOutput(),
  };

  const innerCode = inputNames.map((n) => "${inputs." + n + "}").join(", ");

  const code = `\`Inputs received are: ${innerCode}\``;

  const fnCode = `const result = '(${code})'
  outputs.value.next(result);
  `;

  const dataBuilderSource = btoa(code);

  return inlineValuePart({
    id: `Inline Code ${randomInt(99999)}`,
    inputs,
    outputs,
    runFnRawCode: fnCode,
    customViewCode: code,
    dataBuilderSource,
    templateType: InlineValuePartType.VALUE,
    completionOutputs: ["value"],
    defaultStyle: {
      size: "regular",
      icon: "code",
      cssOverride: {
        fontFamily: "monospace",
        fontWeight: "500",
      },
    },
  });
};
