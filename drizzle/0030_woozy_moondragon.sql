CREATE TABLE "appointment_people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"appointment_id" uuid NOT NULL,
	"name" text NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appointment_person_services" (
	"appointment_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "appointment_person_services_person_id_service_id_pk" PRIMARY KEY("person_id","service_id")
);
--> statement-breakpoint
ALTER TABLE "appointment_people" ADD CONSTRAINT "appointment_people_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_person_services" ADD CONSTRAINT "appointment_person_services_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_person_services" ADD CONSTRAINT "appointment_person_services_person_id_appointment_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."appointment_people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_person_services" ADD CONSTRAINT "appointment_person_services_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "appointment_people_appointment_idx" ON "appointment_people" USING btree ("appointment_id","order_index");--> statement-breakpoint
CREATE INDEX "appointment_person_services_appointment_idx" ON "appointment_person_services" USING btree ("appointment_id");