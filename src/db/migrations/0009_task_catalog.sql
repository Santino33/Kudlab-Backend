CREATE TABLE "task_published_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" varchar(20) NOT NULL,
	"version" integer NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_published_versions_number_unique" UNIQUE("task_id","version"),
	CONSTRAINT "task_published_versions_number_check" CHECK ("task_published_versions"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" varchar(20) PRIMARY KEY NOT NULL,
	"title" varchar(100) NOT NULL,
	"description" text NOT NULL,
	"purpose" text NOT NULL,
	"pedagogical_notice" text NOT NULL,
	"is_enabled" boolean DEFAULT false NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "tasks_code_check" CHECK ("tasks"."id" ~ '^TG-[0-9]{2}$'),
	CONSTRAINT "tasks_revision_check" CHECK ("tasks"."revision" > 0),
	CONSTRAINT "tasks_content_check" CHECK (btrim("tasks"."title") <> '' and btrim("tasks"."description") <> '' and btrim("tasks"."purpose") <> '' and btrim("tasks"."pedagogical_notice") <> '')
);
--> statement-breakpoint
ALTER TABLE "task_published_versions" ADD CONSTRAINT "task_published_versions_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
INSERT INTO "tasks" ("id", "title", "description", "purpose", "pedagogical_notice")
VALUES ('TG-01', 'Lluvia de estrellas',
  'Ficha metodológica de una actividad de atención sostenida y control de respuesta. La integración del juego aún no está comprobada.',
  'Apoyar la observación pedagógica de la atención sostenida y del control de respuesta mediante estímulos objetivo y distractores. La mecánica y la instrumentación deben cotejarse con el proyecto del juego antes de habilitar su uso.',
  'Uso de apoyo pedagógico, no diagnóstico clínico ni sustituto de la evaluación curricular. Esta ficha no ofrece resultados ni indicadores calculados.')
ON CONFLICT ("id") DO NOTHING;
