/** Fixture commands that need the app's service layer. Invoked via `npx tsx` from e2e/helpers/db.ts. */
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { enrollInActiveProgram } from "../../src/lib/enroll";
import { completeLesson, submitModuleQuiz } from "../../src/lib/learn/service";

const db = new PrismaClient();

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  if (cmd === "create-trainee") {
    const [name, email, password] = args;
    const user = await db.user.create({ data: { name, email, passwordHash: await bcrypt.hash(password, 8), role: "TRAINEE" } });
    await enrollInActiveProgram(user.id);
  } else if (cmd === "complete-mandatory") {
    const userId = args[0];
    const enrollment = await db.enrollment.findFirstOrThrow({ where: { userId }, orderBy: { enrolledAt: "asc" } });
    const modules = await db.module.findMany({ where: { programId: enrollment.programId, isMandatory: true }, orderBy: { order: "asc" }, include: { lessons: { orderBy: { order: "asc" } } } });
    for (const m of modules) {
      for (const l of m.lessons) {
        const r = await completeLesson(userId, "TRAINEE", l.id);
        if (!r.ok) throw new Error(`completeLesson ${l.title}: ${r.error}`);
      }
      const qs = await db.quizQuestion.findMany({ where: { programId: enrollment.programId, moduleId: m.id } });
      if (qs.length) {
        const answers = Object.fromEntries(qs.map((q) => [q.id, q.correctAnswer as number | boolean]));
        const r = await submitModuleQuiz(userId, "TRAINEE", m.id, answers);
        if (!r.ok || !r.outcome.passed) throw new Error(`quiz ${m.key} not passed`);
      }
    }
  } else {
    throw new Error(`unknown command ${cmd}`);
  }
}

main().then(() => db.$disconnect()).catch((e) => { console.error(e); process.exit(1); });
