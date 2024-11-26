import { createCallerFactory, createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

const openai = new OpenAI({
  apiKey: process.env['OPENAI_API_KEY'],
});

const PROMPT = `
You are tasked with helping a student solve a math problem.
You must come up with a series of explicit steps taken to solve the problem.
It is of the highest importance that the correct solution will be derived from these steps without error.
Respond in a json structured format like {steps: [{desc: "", code: ""}]}.
Do not provide any other output.
Each step desc should precisely describe how to perform a step.
Math in desc should be presented as katex-supported latex delimited with $$.
All and only numbers in desc (including powers) must be replaced by map entries in the object D, each represented as non-repeating strings of lowercase letters of minimal length surrounded by ~~ on either side as delimiters.
Map values should contain numbers, never strings.
There should never be any numbers in the desc, they must be replaced by ~~entry_name~~.
The answer to a calculation should be on the right side of the equals sign.
Don't calculate values while you solve, only provide the steps to solve the problem.
The code field should contain some javascript code to set the new map entries calculated from the values in the previous step.
Using this data, at each step I will run the code and each variable delimited in the desc will be replaced by values generated by the code.
The first step desc should always state the original problem and the code should initialize the numeric values as map entries.
The subsequent steps should solve the problem incrementally.
If no problem is detected, respond with a single step with no code and a description stating "Um, that's not a math problem".
The last step should contain the most simplified form of the answer on which no further calculations can be made.
I'll provide you with a partial example of the format I expect:
4x - 2 = 2
[{"desc": "Solve for x when $$~~a~~x - ~~b~~ = ~~c~~$$", "code": "d['a'] = 4; d['b'] = 2; d['c'] = 2;"}, {"desc": "Add ~~b~~ to both sides: $$~~a~~x - ~~b~~ + ~~b~~ = ~~c~~ + ~~b~~$$ $$~~a~~x = ~~e~~$$", "code": "d['e'] = d['c'] + d['b'];"}, ...]
`;

const GPTResponse = z.object({
  steps: z.array(z.object({
    desc: z.string(),
    code: z.string(),
  })),
});

const SubmitImageResponse = z.object({
  steps: z.array(z.array(z.string())),
});

type SubmitImageResponseType = {
  steps: string[][];
};

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  submitImage: publicProcedure
    .input(z.object({ imageb64: z.string().min(1) }))
    .output(SubmitImageResponse)
    .mutation(async ({ input }) => {
      console.log(input.imageb64);
      const completion = await openai.beta.chat.completions.parse({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: PROMPT },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  "url": input.imageb64,
                },
              }
            ],
          },
        ],
        response_format: zodResponseFormat(GPTResponse, "event"),
      });

      const event: {steps: {desc: string, code: string}[]} = completion.choices[0]?.message.parsed || {steps:[{desc: "Execution error", code: ""}]};
      console.log(event);

      let d: { [key: string]: number } = {};
      const solvedSteps = event.steps.map(step => {
        const code = step.code;
        // run code to generate variable values
        eval(code); // if this was production, I might sandbox this but not worth the effort now
        // Go through each step and replace their variables with the values generated by the code
        return step.desc.replace(/~~(\w+)~~/g, (match, name) => {
            return d[name] || match;
        }).split('$$');
      });

      return {
        steps: solvedSteps
      };
    }),
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
