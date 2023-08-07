import {
  InlineValueNodeType,
  nodeInput,
  nodeOutput,
  randomInt,
} from "@flyde/core";
import { inlineValueNode } from "@flyde/core";

export const createDefaultNode = (inputNames: string[]) => {
  const inputs = inputNames.reduce((prev, curr) => {
    return { ...prev, [curr]: nodeInput() };
  }, {});

  const outputs = {
    value: nodeOutput(),
  };

  const innerCode = inputNames.map((n) => "${inputs." + n + "}").join(", ");

  const code = `\`Inputs received are: ${innerCode}\``;

  const fnCode = `const result = '(${code})'
  outputs.value.next(result);
  `;

  const dataBuilderSource = btoa(code);

  return inlineValueNode({
    id: `Inline Code ${randomInt(99999)}`,
    inputs,
    outputs,
    runFnRawCode: fnCode,
    customViewCode: code,
    dataBuilderSource,
    templateType: InlineValueNodeType.VALUE,
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
