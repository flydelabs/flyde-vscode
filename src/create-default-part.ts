import { CodePartTemplateTypeInline, partInput, partOutput, randomInt } from "@flyde/core";
import { codePart } from "@flyde/core";

export const createDefaultPart = (inputNames: string[]) => {

  const inputs = inputNames.reduce((prev, curr) => {
    return { ...prev, [curr]: partInput("any", "required") };
  }, {});

  const outputs = {
    value: partOutput("any"),
  };

  const innerCode = inputNames.map(n => '${inputs.' + n + '}').join (', ');

  const code = `\`Inputs received are: ${innerCode}\``;

  const fnCode = `const result = '(${code})'`;

  const dataBuilderSource = btoa(code);

  return codePart({
    id: `Inline Code ${randomInt(99999)}`,
    inputs,
    outputs,
    fnCode,
    customViewCode: code,
    dataBuilderSource,
    templateType: CodePartTemplateTypeInline.VALUE,
    completionOutputs: ["value"],
    defaultStyle: {
      size: 'regular',
      icon: 'code',
      cssOverride: {
        fontFamily: 'monospace',
        fontWeight: '500'
      }
    }
  });
};
