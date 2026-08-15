-- ============================================================
-- QATA ERP — INSTALACIÓN SUPABASE NUEVO
-- Ejecutar UNA SOLA VEZ en Supabase > SQL Editor > New query > Run
-- No requiere Firebase, Replit ni backend adicional.
-- ============================================================

begin;

create extension if not exists pgcrypto;

-- 1) Almacenamiento genérico compatible con la estructura actual del ERP.
create table if not exists public.qata_documents (
  bucket text not null,
  id text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (bucket,id)
);

create index if not exists qata_documents_bucket_idx on public.qata_documents(bucket);
create index if not exists qata_documents_created_idx on public.qata_documents(created_at desc);

-- 2) Correlativos configurables desde Administración.
create table if not exists public.qata_sequences (
  document_type text primary key,
  prefix text not null default '',
  suffix text not null default '',
  next_number bigint not null default 1 check (next_number >= 1),
  padding integer not null default 4 check (padding between 1 and 12),
  updated_at timestamptz not null default now()
);

insert into public.qata_sequences(document_type,prefix,suffix,next_number,padding)
values
  ('OC','OC-','',1,4),
  ('OS','','D',1,7),
  ('GUIA','GR-ALM-','',1,4)
on conflict (document_type) do nothing;

-- 3) Rol ERP del usuario conectado. SECURITY DEFINER evita recursión de RLS.
create or replace function public.qata_current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select lower(coalesce(d.data->>'rol',''))
  from public.qata_documents d
  where d.bucket='usuarios'
    and d.id=auth.uid()::text
  limit 1;
$$;

revoke all on function public.qata_current_role() from public;
grant execute on function public.qata_current_role() to authenticated;

-- 4) RLS: ningún dato queda abierto al público/anon.
alter table public.qata_documents enable row level security;
alter table public.qata_sequences enable row level security;

drop policy if exists qata_documents_select on public.qata_documents;
create policy qata_documents_select
on public.qata_documents for select
to authenticated
using (public.qata_current_role() in ('admin','editor'));

drop policy if exists qata_documents_insert on public.qata_documents;
create policy qata_documents_insert
on public.qata_documents for insert
to authenticated
with check (
  public.qata_current_role()='admin'
  or (public.qata_current_role()='editor' and bucket in ('productos','requerimientos'))
);

drop policy if exists qata_documents_update on public.qata_documents;
create policy qata_documents_update
on public.qata_documents for update
to authenticated
using (
  public.qata_current_role()='admin'
  or (public.qata_current_role()='editor' and bucket in ('productos','requerimientos'))
)
with check (
  public.qata_current_role()='admin'
  or (public.qata_current_role()='editor' and bucket in ('productos','requerimientos'))
);

drop policy if exists qata_documents_delete on public.qata_documents;
create policy qata_documents_delete
on public.qata_documents for delete
to authenticated
using (
  public.qata_current_role()='admin'
  or (public.qata_current_role()='editor' and bucket in ('productos','requerimientos'))
);

drop policy if exists qata_sequences_select on public.qata_sequences;
create policy qata_sequences_select
on public.qata_sequences for select
to authenticated
using (public.qata_current_role()='admin');

-- Permisos Data API (RLS sigue siendo quien decide si la operación pasa).
revoke all on table public.qata_documents from anon;
revoke all on table public.qata_sequences from anon;
grant select,insert,update,delete on table public.qata_documents to authenticated;
grant select on table public.qata_sequences to authenticated;

-- 5) Función atómica para emitir el próximo correlativo.
--    Si el administrador coloca un número ya utilizado, lo salta automáticamente.
create or replace function public.qata_next_sequence(p_type text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_type text := upper(trim(coalesce(p_type,'')));
  v_seq public.qata_sequences%rowtype;
  v_number bigint;
  v_result text;
  v_bucket text;
  v_field text;
  v_exists boolean;
begin
  v_role := public.qata_current_role();
  if v_role <> 'admin' then
    raise exception 'SOLO_ADMIN_PUEDE_EMITIR_CORRELATIVOS';
  end if;

  if v_type not in ('OC','OS','GUIA') then
    raise exception 'TIPO_CORRELATIVO_INVALIDO';
  end if;

  select * into v_seq
  from public.qata_sequences
  where document_type=v_type
  for update;

  if not found then
    raise exception 'CORRELATIVO_NO_CONFIGURADO';
  end if;

  v_number := v_seq.next_number;
  v_bucket := case v_type when 'OC' then 'ordenesCompra' when 'OS' then 'ordenesServicio' else 'guiasRemision' end;
  v_field := case v_type when 'OC' then 'nroOC' when 'OS' then 'nroOS' else 'nroGR' end;

  loop
    v_result := v_seq.prefix || lpad(v_number::text, v_seq.padding, '0') || v_seq.suffix;
    select exists(
      select 1 from public.qata_documents d
      where d.bucket=v_bucket and d.data->>v_field=v_result
    ) into v_exists;
    exit when not v_exists;
    v_number := v_number + 1;
  end loop;

  update public.qata_sequences
  set next_number=v_number+1, updated_at=now()
  where document_type=v_type;

  return v_result;
end;
$$;

revoke all on function public.qata_next_sequence(text) from public;
grant execute on function public.qata_next_sequence(text) to authenticated;

-- 6) Administración de correlativos desde el ERP.
create or replace function public.qata_set_sequence(
  p_type text,
  p_prefix text,
  p_suffix text,
  p_next_number bigint,
  p_padding integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text := upper(trim(coalesce(p_type,'')));
begin
  if public.qata_current_role() <> 'admin' then
    raise exception 'SOLO_ADMIN_PUEDE_CONFIGURAR_CORRELATIVOS';
  end if;
  if v_type not in ('OC','OS','GUIA') then raise exception 'TIPO_CORRELATIVO_INVALIDO'; end if;
  if coalesce(p_next_number,0) < 1 then raise exception 'PROXIMO_NUMERO_INVALIDO'; end if;
  if coalesce(p_padding,0) < 1 or p_padding > 12 then raise exception 'DIGITOS_INVALIDOS'; end if;

  insert into public.qata_sequences(document_type,prefix,suffix,next_number,padding,updated_at)
  values(v_type,coalesce(p_prefix,''),coalesce(p_suffix,''),p_next_number,p_padding,now())
  on conflict(document_type) do update set
    prefix=excluded.prefix,
    suffix=excluded.suffix,
    next_number=excluded.next_number,
    padding=excluded.padding,
    updated_at=now();

  return jsonb_build_object(
    'document_type',v_type,
    'preview',coalesce(p_prefix,'')||lpad(p_next_number::text,p_padding,'0')||coalesce(p_suffix,''),
    'next_number',p_next_number
  );
end;
$$;

revoke all on function public.qata_set_sequence(text,text,text,bigint,integer) from public;
grant execute on function public.qata_set_sequence(text,text,text,bigint,integer) to authenticated;

-- 7) Utilidad de instalación: después de crear un usuario en Authentication,
--    ejecuta: select public.qata_grant_admin('tu-correo@empresa.com');
create or replace function public.qata_grant_admin(p_email text)
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_id uuid;
begin
  select id into v_id from auth.users where lower(email)=lower(trim(p_email)) limit 1;
  if v_id is null then raise exception 'USUARIO_AUTH_NO_ENCONTRADO'; end if;

  insert into public.qata_documents(bucket,id,data,updated_at)
  values('usuarios',v_id::text,jsonb_build_object('rol','admin','email',lower(trim(p_email))),now())
  on conflict(bucket,id) do update set
    data=public.qata_documents.data || excluded.data,
    updated_at=now();

  return v_id::text;
end;
$$;

-- Solo se usa desde SQL Editor durante la instalación. No se expone al frontend.
revoke all on function public.qata_grant_admin(text) from public, anon, authenticated;

-- 8) Configuración inicial del ERP (incluye Cambridge y condiciones OC/OS).
insert into public.qata_documents(bucket,id,data,updated_at)
values (
  'configuracion',
  'documentos',
  $json$
{
  "configVersion": 2,
  "empresa": {
    "razonSocial": "QATA ASOCIADOS S.A.C.",
    "ruc": "20605226362",
    "direccion": "Av. Camino Real 1236, San Isidro - Lima",
    "correo": "Paster@grupoqata.pe",
    "telefono": "957 254 498"
  },
  "compradores": [
    {
      "nombre": "Paul Aster",
      "tlf": "957 254 498",
      "correo": "Paster@grupoqata.pe"
    },
    {
      "nombre": "Dave Cardenas",
      "tlf": "942 628 722",
      "correo": "Dcardenas@grupoqata.pe"
    },
    {
      "nombre": "Manuel Vega",
      "tlf": "",
      "correo": ""
    }
  ],
  "proyectos": [
    {
      "nombre": "CAMBRIDGE",
      "direccion": "Colegio Cambridge, Chorrillos Alameda De Los Molinos 728-730, Chorrillos"
    },
    {
      "nombre": "TORRE PRIMA",
      "direccion": "Calle Chinchon 980, San Isidro"
    },
    {
      "nombre": "GRID 154",
      "direccion": "Calle Mario Valdivia 154, San Miguel"
    },
    {
      "nombre": "WYNK",
      "direccion": "Jr.Ucello 111, San Borja"
    },
    {
      "nombre": "PISO 19A",
      "direccion": "Av. EL Derby 2550, Santiago de Surco"
    },
    {
      "nombre": "PISO 19B",
      "direccion": "Av. EL Derby 2550, Santiago de Surco"
    },
    {
      "nombre": "POSVENTA",
      "direccion": "Av. Caminon Real 1236, San Isidro"
    },
    {
      "nombre": "QUALITY",
      "direccion": "Centro Comercial Puruchuco"
    },
    {
      "nombre": "CORIL",
      "direccion": "Av. EL Derby 2550, Santiago de Surco"
    },
    {
      "nombre": "CARSA SJL",
      "direccion": ""
    },
    {
      "nombre": "ADMIN",
      "direccion": "Av. Caminon Real 1236, San Isidro"
    },
    {
      "nombre": "FUXION",
      "direccion": "Av. EL Derby 2550, Santiago de Surco"
    }
  ],
  "formasPago": [
    "CRÉDITO",
    "TRANSFERENCIA",
    "CAJA CHICA",
    "TARJETA",
    "ER"
  ],
  "proyectoPredeterminado": "CAMBRIDGE",
  "horarioRecepcion": "LUN - VIE DE 8:AM - 4:00PM",
  "os": {
    "correlativoSufijo": "D",
    "condicionPago": "Sólo luego de recibida y aceptada la factura remitida al buzón indicado por QATA, el pago se realizará:\n- Adelantos: Hasta 02 días hábiles después\n- Valorizaciones / liquidaciones: Hasta 10 días hábiles después",
    "horarioFacturas": "- Lunes a viernes de 8:30 a.m. a 05:00 p.m.",
    "horarioObra": "- Confirmar horario de trabajo permitido con el supervisor y/o residente encargado.",
    "requisitosIngreso": "- Documentos chofer/ayudantes: DNI, copia SCTR, licencia de conducir.\n- Documentos vehículo: revisión técnica vigente, tarjeta de propiedad, SOAT y Certificado de transporte de mercancías.\n- EPP: zapatos punta acero, guantes, casco, lentes de seguridad, chaleco, polo o camisa manga larga.\n- EPC: 02 conos de seguridad, 02 tacos de madera de seguridad, extintor, botiquín, no presentar fugas de ningún tipo.",
    "documentosEntrega": "- Copia simple de la orden de compra\n- Guía Remisión-Remitente\n- Certificado de calidad original físico con el sello y firma del proveedor directo, en español",
    "aprobadorNombre": "ARQ. RODRIGO RENGIFO BRICEÑO",
    "aprobadorCargo": "Director de Operaciones",
    "tipologia": "Servicio",
    "clasificacion": "Valorización",
    "porcentaje": "",
    "moneda": "PEN Soles",
    "lugarEntrega": "En el proyecto"
  },
  "documentacionObligatoria": "Se solicita adjuntar todos los documentos técnicos y de respaldo correspondientes a los productos o servicios cotizados, según aplique, tales como: certificados de calidad, garantías del fabricante o distribuidor. Estos documentos son requisitos obligatorios para la validación y recepción conforme.",
  "terminosCondiciones": "En caso la presente OC y/o OS activará la generación de un subcontrato, este deberá ser firmado entre las partes en un plazo máximo de 20 días, documento que prevalecerán sobre la presente OC y/o OS (incluidos los Términos y Condiciones Generales); es imperioso precisar que la presente OC y/o OS quedará sin efecto, en caso el proveedor incumpla con alguno o todos los aspectos comprometidos en las condiciones técnicas-comerciales pactadas o en caso no se llegue a un acuerdo contractual y por lo tanto no se firme el Subcontrato en el plazo estipulado, para lo cual bastará una comunicación escrita de QATA ASOCIADOS S.A.C. dirigida al proveedor.\n1. Definiciones:\na. Proveedor o Vendedor es la entidad que vende los materiales y/o servicios incluidos en la presente orden de compra/servicio bajo los términos y condiciones aquí especificadas.\nb. Comprador, cliente, usuario o QATA significa QATA ASOCIADOS S.A.C. La presente orden de compra/servicio supera cualquier otra coordinación o compromiso relacionado a la compra-venta de los materiales/servicios aquí incluidos y se transforma en el vínculo único y exclusivo que regula dicho Contrato. El proveedor reconoce que la presente orden de compra/servicio se entenderá aceptada en todos sus términos y condiciones una vez enviada la aceptación escrita o una vez que se realicen las gestiones para su atención, o lo que ocurra primero.\n2. Comunicaciones:\nPara todo propósito, las comunicaciones deberán realizarse por escrito. El proveedor deberá dirigir sus comunicaciones al encargado de seguimiento que figura en la comunicación con que se formalizó la presente orden de compra/servicio. El costo relacionado al envió físico de documentación o cualquier otro material dentro de la vigencia de esta orden de compra/servicio será asumido por la parte que origina dicho envío. Toda instrucción de despacho/entrega deberá ser originada o aprobada por el personal autorizado del área de operaciones de QATA ASOCIADOS S.A.C. Cualquier despacho/entrega que el proveedor realice en incumplimiento de estas instrucciones, se realizará a su cuenta y riesgo, sin responsabilidad alguna para QATA ASOCIADOS S.A.C.\n3. Precio:\nLos precios unitarios detallados en esta orden de compra/servicio, en cualquier moneda en la que sean expresados, son fijos y no están sujetos a ningún tipo de reajuste por inflación, tipo de cambio, índice de precios ni ninguno otro durante la vigencia de esta orden, salvo sea expresamente indicado en este documento. El valor total de esta orden de compra/servicio es final y corresponde a las condiciones, lugares de entrega y transferencia de responsabilidades en ella indicadas, o según los Incoterms acordados. No existe costo adicional alguno o pendiente de definición por ningún concepto, salvo sea expresamente indicado en este documento, en tal sentido, el proveedor renuncia en forma expresa a presentar reclamo futuro respecto a la contraprestación pactada.\n4. Términos de pago:\nEl pago de esta orden de compra/servicio se realizara mediante transferencia bancaria a la cuenta indicada por el proveedor, 100% neto, según el plazo establecido en la presente orden, contado a partir de la presentación de la factura comercial, correctamente emitida, según lo detallado en este documento, en el departamento de Administración de QATA, luego de la entrega satisfactoria de los productos en las condiciones acordadas, o según el cronograma de pago establecido para esta orden y no medie incumplimiento alguno de su parte a la orden de compra, sus empleados y/o colaboradores y proveedores. Se podrán pactar entrega y facturaciones parciales, salvo instrucción expresa en contrario por parte de QATA.\n5. Precaución:\nEn caso de que sea necesario que el vendedor por sí mismo o por medio de algún agente, subcontratista o empleado ingrese a las Sedes de QATA o de terceros vinculados a ella(s), con la finalidad de construir, reparar, inspeccionar o hacer entregas de acuerdo con este pedido/servicio, el vendedor por medio de la presente se obliga y conviene en usar, proveer y tomar las precauciones y protecciones necesarias y suficientes para evitar que sobrevengan en conexión con este trabajo cualquier accidente, lesión, daño o avería a las personas o la propiedad de QATA, de terceros y/o del propio vendedor o proveedor, y se obliga a obedecer todas la reglas de seguridad y protección establecida en las instalaciones de QATA. Igualmente se obliga a responder e indemnizar íntegramente a QATA de cualquier perdida, gastos o perjuicios ocasionado a él o a su propiedad y de cualquier reclamo o litigio que por causa de cualesquiera de esos accidentes, lesiones, derrames, daños, averías, multas o sanciones que puedan suceder u ocurrir como consecuencia o en conexión con el objeto de la presente orden de compra/servicio, aun cuando tal avería, pérdida, multa, sanción o perjuicio sea causado en parte o totalmente por negligencia de QATA o de sus empleados. Asimismo se compromete el vendedor a indemnizar íntegramente a QATA de cuales quiera multa, sanciones y pérdidas incurridas como consecuencia de la infracción de cualquier ley y reglamento municipal, provincial, departamental o estatal en conexión con dicho trabajo o con las mercaderías, bienes, servicios o materiales a los que se refiere el presente pedido. El vendedor igualmente se obliga, con respecto a los empleados y obreros que tome a su servicio para cumplir el contrato a asumir todas las responsabilidades y obligaciones derivadas de los contratos de trabajo, respetando las leyes del trabajo y demás leyes sociales, liberando a QATA de toda responsabilidad que por tal circunstancia fuera pretendida contra QATA por los trabajadores, ex trabajadores o terceros vinculados con el proveedor, vendedor o contratista.\n6. Plazo de entrega:\nLa fecha de entrega pactada en esta orden de compra constituye el compromiso final, fijo e inalterable asumido por el proveedor para la entrega completa de los materiales y trabajos incluidos en ella. La entrega de los materiales incluidos en esta orden se realizará en o antes de la fecha indicada, de ser necesario en coordinación con el comprador. La totalidad de los servicios y, en su caso, cualquier porción de los mismos que tenga especificado un plazo determinado en la Orden de Compra/servicio deberán ser terminados dentro de dicho plazo. En caso de incumplimiento en las condiciones de la Orden de Compra/Servicio, el proveedor se hará pasible de una penalidad acordada por las partes, la cual será proporcional a los gastos administrativos y perjuicios originados por dicho incumplimiento.\n7. Tiempo como esencia del acuerdo:\nSe deja expresa constancia que los plazos de entrega pactados son parte esencial de este acuerdo comercial. De no cumplirse, QATA podrá, en adición a cualquier demanda posterior de penalidades o daños según lo indicado en esta orden y en arreglo a las leyes vigentes, resolver o cancelar esta orden de compra, parcial o totalmente, sin más mecanismo que la comunicación escrita al proveedor anunciando dicha cancelación por incumplimiento de plazo de entrega, sin obligación de pagar por la porción aun no entregada, debiendo el proveedor reembolsar los montos adelantados.\n8. Documentación:\nLa documentación requerida es parte del compromiso de entrega asumido por el proveedor. QATA reconoce al proveedor como especialista en el diseño y/o fabricación y/o provisión de los productos incluidos en la presente orden y los documentos relacionados, como planos, cálculos, hojas técnicas, especificaciones, certificaciones, etc. El proveedor reconoce por tanto que la aceptación por parte de QATA de cualquier documentación técnica no reemplaza su responsabilidad final por la exactitud y aplicabilidad de dicha información a los productos entregados.\n9. Penalidad por retrasos en la entrega de materiales / servicios:\nEl proveedor garantiza el cumplimiento de la fecha pactada en esta orden de compra/ servicios para la entrega de los materiales/ servicios en ella incluidos. El incumplimiento en la fecha pactada para la entrega de materiales/ servicios resulta en daños sustanciales para QATA. Se acuerda por tanto, que en caso de retraso en la entrega de los materiales y/o servicios comprendidos en esta orden de compra/ servicios, con relación a los plazos fijados, QATA podrá decidir entre la CANCELACION de la orden de compra/ servicios o aplicar una penalidad al Vendedor del 5/100 (5%) adicional sobre el importe con demora al vencimiento del plazo de entrega indicado, por cada día de atraso. Esta penalidad abarcará desde el día fijado como plazo de entrega y hasta un máximo del 25% ( veinticinco por ciento) del valor total de la orden de compra/ servicios.\nLos pagos por concepto de las penalidades descritas en esta cláusula podrán deducirse de cualquier monto pendiente por pagar al proveedor en virtud de esta o cualquier otra orden de compra u orden de servicio que mantenga con QATA.\nEn caso de cancelación de la Orden de Compra/ servicios, QATA, certificará el valor de los servicios ejecutados y productos entregados satisfactoriamente de acuerdo con la orden de compra/ servicios, siendo dicho valor el que se considerará como el monto adeudado al proveedor tras deducirse el valor de todos los pagos anteriormente realizados, más las retenciones que correspondieren en virtud de penalidades, multas, sanciones o cualquier otro motivo contemplado en este documento.\nA la fecha de conclusión de la orden de compra / servicios el proveedor está obligado a devolver a QATA toda la información y documentación que ésta le hubiere entregado.\n10. Sustitución de productos:\nNo se aceptarán sustituciones de productos, a excepción de aquellas aprobadas por escrito por QATA. Los cambios o reemplazos en las características físicas o de denominación de un producto/servicio, incluyendo descripciones, números de parte, competencias, composiciones o cualquier otra especificación, deberán ser comunicados por escrito a QATA para su aprobación previa a la entrega de dichos materiales.\n11. Instrucciones de facturación:\nSe deberá remitir la factura en original al correo señalado, respetando el hilo de correos precedentes, es decir, respondiendo al correo electrónico enviado por el comprador de QATA en el que se adjunta la presente orden de compra / servicio.\nLas discrepancias entre el valor de la presente orden de compra/servicio y las facturas recibidas imposibilitan el pago de dichas facturas, por lo que serán rechazadas, sin lugar a reclamo por parte del proveedor.\n12. Detracciones:\nAplicable a proveedores domiciliados en el Perú. Se realizarán directamente al Banco de la Nación según apliquen. Para el cálculo se tomará el porcentaje especificado en la norma y se redondeará hacia arriba.\n13. Calidad y garantía:\nEl proveedor garantiza expresamente los productos/servicios suministrados bajo esta orden de compra/servicio contra defectos en el diseño, materiales, mano de obra o calidad de fabricación, por un periodo mínimo de 12 meses desde la puesta en servicio o 18 meses desde la entrega, aquello que ocurra primero; además de las garantías adicionales que se incluyan en su oferta, siempre que sean mayores a las mínimas indicadas en esta Cláusula. Bajo condiciones normales de uso y servicio, durante el período de garantía cada producto/ servicio estará libre de defectos físicos o vicios en lo referente a materiales y calidad de fabricación; en caso contrario el producto será reparado o reemplazado. El proveedor se compromete a reemplazar a su costo cualquier producto/servicio defectuoso o que no cumpla con las características o especificaciones acordadas. El proveedor asumirá además los costos de manipulación, reproceso, embalaje, internamiento y transporte a QATA en los casos en que este haya incurrido en dichos costos en relación a los productos defectuosos. El proveedor se compromete además a entregar los certificados de calidad y/o garantía correspondientes a los productos / servicios adquiridos bajo esta orden de compra. QATA se reserva el derecho de realizar las inspecciones que juzgue necesarias directa o indirectamente durante los procesos de fabricación a fin de comprobar la calidad ofrecida por el proveedor. Asimismo, QATA podrá encargar o realizar directamente los análisis que estime convenientes para confirmar las características técnicas de los productos suministrados. QATA se reserva el derecho de solicitar y revisar la información que acredite la competencia y calificación del personal que interviene en la prestación del servicio.\n14. Seguimiento de la orden de compra:\nEl proveedor se compromete a brindar la información sobre el estado de la orden de compra / servicios cuando sea requerida durante la vigencia de la misma por parte de QATA. El proveedor se compromete además a informar inmediatamente y por escrito a QATA, cualquier condición que afecte la fecha de entrega de los productos/ servicios.\n15. Sub Proveedores:\nDe ser solicitadas, el proveedor entregara a QATA copias no valorizadas de las órdenes que hayan sido emitidas a sus Sub-Proveedores como parte del proceso de atención de la compra-venta a QATA.\n16. Inspecciones:\nQATA se reserva el derecho de llevar a cabo las inspecciones que estime convenientes en las instalaciones del proveedor o sus contratistas o sub-proveedores para asegurar el cumplimento tanto de aspectos técnicos y de calidad como de cronograma de entrega. El proveedor deberá otorgar las facilidades necesarias para tales inspecciones, de lo contrario, QATA podrá resolver o cancelar total o parcialmente esta orden de compra/ servicios.\n17. Logística y almacenamiento:\nLa entrega de los productos deberá ser respaldada por la guía de remisión o packing list detallados, según sea el caso y por la factura comercial y demás documentos requeridos. La guía de remisión emitida por el proveedor deberá consignar las descripciones y referencias completas a la orden de compra atendida, incluyendo número de orden, ítem de la orden, código de material, precio unitario, etc. Los productos amparados en guías de remisión que no cumplan con lo establecido en este punto podrán ser rechazados, manteniéndose como no recibidos en los registros de QATA y originando las penalidades que correspondan según lo establecido en esta orden de compra/ servicio.\n18. Transporte:\nEn caso la entrega haya sido pactada en las instalaciones de QATA o proyectos específicos, el proveedor deberá asegurar que las unidades de transporte empleadas cumplan con las condiciones de operatividad, seguridad y ambiental de QATA y todas aquellas que les sean aplicables por las leyes o regulaciones vigentes, incluidas pero no limitadas al control de emisiones, derrames, revisiones técnicas, trasporte de materiales o productos peligrosos, productos fiscalizados, disponibilidad de implementos de seguridad de la unidad y de sus operadores, etc. QATA podrá impedir el acceso a sus instalaciones a aquellas unidades de transporte que no cumplan con lo estipulado en este punto, no haciéndose responsable de costos de re-envió, sobre-estadías o fletes no realizados y manteniendo las mercancías como no atendidas en sus registros, dando lugar a las penalidades que esto suponga.\n\n\n\n\n\n\n\n\n\nTÉRMINOS Y CONDICIONES GENERALES DE COMPRAS, SERVICIOS Y CONTRATACIONES [HOJA 3 de 4]\n\n19. Embalajes y marcas:\nLos precios detallados en esta orden de compra incluyen empaque, embalaje y cualquier otro medio necesario para garantizar la protección e identificación de los materiales durante su transporte multimodal a su destino final en las instalaciones de QATA o proyectos específicos y su almacenamiento en dicha ubicación final. Además de lo anterior, el proveedor se obliga a realizar un correcto empaque y embalaje de los materiales que suministre bajo el amparo de esta orden de compra/servicio, de forma que se permite una manipulación adecuada y segura de los bultos, piezas o paquetes que se reciban en las instalaciones de QATA o proyectos específicos. El proveedor deberá cumplir con las disposiciones legales aplicables para el embalaje y empaque. Los bultos de naturaleza especial, incluidos pero no limitados a planchas, contenedores de gráneles (IBC’s), bidones, tambores, cilindros, big bags, sacos, bolsas, carretes, etc., deberán entregarse paletizados o embalados de forma que permitan su manipulación correcta y segura. QATA podrá rechazar, directamente la recepción de cualquier mercancía que no cumpla con lo estipulado en esta cláusula. En caso tal rechazo se produzca, los materiales se entenderán por no recibidos, dando lugar a las penalidades o recargos que esta orden establece. Los costos requeridos para la corrección de las condiciones que originen el mencionado rechazo, serán asumidos enteramente por el proveedor, incluyendo los costos de sobreestadía de unidades de transporte o fletes no realizados cuando QATA sea quien recoge las mercancías de las instalaciones del proveedor o sus sub-proveedores. Los recipientes, el empaque y el embalaje deben considerar los siguientes criterios:\na. Reducir al mínimo indispensable la cantidad de empaques y rechazar materiales cuya durabilidad o vida útil sea relativamente baja.\nb. El proveedor debe brindar facilidades para el retorno de los empaques, embalajes, recipientes, productos obsoletos y dañados para su disposición final o reutilización total o parcial en sus instalaciones, siempre que sea posible.\nc. Los productos químicos deberán entregarse sin excepción acompañados de la hoja técnica y la hoja de datos de seguridad (MSDS) así como la hoja de resumen de traslado, aprobada por el área de seguridad y medio ambiente de QATA, así como las especificaciones estipuladas por las instituciones fiscalizadoras. En caso de reemplazo de productos o actualizaciones de la hoja de datos de seguridad, deberá ser enviada para su aprobación antes de la entrega del producto.\nd. Las partes que contengan combustibles, aceites o grasas deberán ser contenidos de manera que se impida la dispersión, derrame o evaporación de dichas sustancias.\ne. En lo que resulte aplicable, los proveedores deberán cumplir con las disposiciones legales vigentes del Perú, incluidas pero no limitadas a las siguientes: Ley 28305 (Ley de Insumos Químicos Fiscalizados y Productos Controlados). Ley 28028 (Ley de Regulación del uso de Fuentes de Radiación Ionizante). R.D.134-2000-EM (lineamientos para planes de contingencia relacionadas a sustancias toxicas y peligrosas). Ley 28256 (Ley de Transporte de Materiales Peligrosos).\nf. El embalaje para la importación a Perú deberá contar con el registro y sello colocado por la autoridad sanitaria del país de origen, el mismo que debe contener las siguientes características: información según la norma NIMF-15 (consignar código de país, código de entidad autorizada a realizar el tratamiento, tipo de tratamiento, código IPPC del país de origen, código ISO del país de origen).\ng. La información deberá ser claramente visible, en letras claras y claramente identificables. QATA comunicará oportunamente cualquier necesidad especial de marcas.\n20. Notificación de entrega:\nEl proveedor deberá notificar, mediante correo electrónico dirigido al encargado de seguimiento, con una anticipación no menor a 7 días, cuando las mercancías estén listas para su recojo o entrega. Dicha notificación deberá incluir el detalle de bultos a entregarse incluyendo sus pesos y medidas, además de cualquier otra consideración que se estime conveniente.\n21. Recomendaciones de transporte y almacenamiento:\nEl proveedor deberá incluir en la notificación de entrega referida en la cláusula anterior, las instrucciones y recomendaciones necesarias para el correcto transporte, almacenamiento y cuidado de los materiales entregados. Estas recomendaciones deberán asumir un periodo de almacenamiento de un año calendario desde la entrega de los materiales, en condiciones de intemperie.\n22. Fuerza Mayor:\nEn caso el incumplimiento de cualquier obligación emanada de la presente orden de compra u orden de servicio, se diese por caso fortuito o fuerza mayor, las obligaciones a cargo de las partes no serán exigibles. En caso no se cumpliese con las obligaciones debido al caso fortuito o fuerza mayor, por un periodo mayor a 15 días hábiles, QATA o el proveedor podrá dar por resuelto la presente orden, debiendo comunicarlo por escrito a la otra parte. No obstante lo anterior, la parte que alegue caso fortuito o fuerza mayor como causa de su incumplimiento, tomará las medidas razonables para mitigar y/o eliminar el impacto que dicho caso fortuito o de fuerza mayor pueda producir sobre el cumplimiento de las obligaciones contraídas en virtud de este instrumento, debiendo comunicar a la otra parte de tales medidas.\n23. Independencia de cláusulas:\nLas clausulas incluidas en la presente orden de compra/ servicio son independientes. La inaplicabilidad de alguna de ellas en condiciones particulares, no exime del cumplimiento del resto de ellas.\n24. Ley aplicable y arbitraje:\nEn todo lo aplicable, la presente orden de compra se regirá a la legislación peruana. En caso surgieran controversias con respecto al correcto cumplimiento de las obligaciones estipuladas en el presente acuerdo, las partes, con el fin de resolverlas, trataran de solucionarlas mediante negociaciones directas entre sus representantes, quienes tendrán absoluta capacidad para resolver los problemas planteados. Para este efecto, a más tardar tres días útiles después que una de las partes notifique por escrito a la otra la existencia de un punto o puntos controversiales, cada una designara un máximo de dos representantes, los que dentro de los siete días útiles siguientes, deberán instalarse para contemplar una posible solución a los problemas planteados, debiendo pronunciarse en forma definitiva en el plazo máximo de diez días útiles. El incumplimiento de las partes de los términos indicados, determinara su renuncia expresa al uso de este sistema. De no arribarse a ningún acuerdo satisfactorio en negociación directa, las partes someterán la controversia al centro de arbitraje de la Cámara de Comercio e Industria de Lima, a cuyo reglamento se someten en forma incondicional.\n\n25. Resolución por conveniencia:\nQATA podrá resolver esta orden de compra / servicio en forma parcial o total, debiendo comunicar por escrito dicha cancelación al proveedor, quien cesara todo proceso relacionado a la atención de la parte cancelada. Para este supuesto, QATA deberá comunicar al proveedor su decisión de poner término a la Orden de Compra / servicio con una antelación no menor a quince (15) días a la fecha de terminación, señalando expresamente la fecha efectiva de resolución. QATA se obliga a compensar al proveedor por los costos incurridos en la parte cancelada hasta el momento de la notificación de cancelación, salvo lo indicado en la Cláusula 4 de esta orden.\nLos pagos por resolución a los que hace referencia el párrafo anterior se limitan a los costos efectivamente incurridos y sustentados documentariamente por el proveedor y no incluyen utilidades dejadas de percibir, lucro cesante ni ningún otro concepto indemnizatorio.\n26. Protección de datos personales:\nEl Proveedor consiente de manera libre y expresa el tratamiento y almacenamiento de sus datos personales en un banco de datos personales para proveedores de titularidad de QATA, por un periodo de cinco (5) años, con la finalidad de que ésta última, utilice dicha información de manera confidencial para cumplir exclusivamente con los fines de la relación comercial entre el proveedor y QATA, de acuerdo a lo establecido en la Ley de Protección de Datos Personales y su Reglamento.\n27. Seguridad, Salud Ocupacional, Medio Ambiente y Responsabilidad Social:\nPara toda orden de compra u orden de servicio que sea requerida por cualquiera de las Sedes operativas de SM # UNM # UNC; será aplicable la normativa legal vigente y se tendrá en cuenta las siguientes:\na. DS-024-2016-EM y sus modificatorias.\nb. Ley 29783 / Reglamento # 005 # Supra-sectorial.\nc. Otros según sea el caso.\nPara trabajos y servicios específicos se tendrán consideraciones a nivel de clientes y sus respectivos Manuales de Seguridad, Salud Ocupacional, Medio Ambiente y Responsabilidad Social, Directivas Corporativas o exigencias propias de cada uno de nuestros clientes; las mismas que deberán cumplirse en su totalidad como parte de la aceptación de compras, servicios y contrataciones.\nConsiderar que los estándares de Seguridad, Salud Ocupacional, Medio Ambiente y Responsabilidad Social con los que QATA Gestiona están alineados a la Normativa Legal Vigente mencionada en el anterior párrafo. Será responsabilidad del proveedor los incumplimientos, sanciones, multas, entre otros que sobrevengan ante los incumplimientos de Seguridad, Medio Ambiente y Responsabilidad Social y las exigencias de nuestros clientes, asumiendo en su totalidad los gastos u otros en los que QATA pueda incurrir.\nConsiderar que las especificaciones en trabajos puntuales y las exigencias de Seguridad, Salud, Ambiente y Responsabilidad Social que sean aplicables a compras, servicios y contrataciones podrán marcar diferencias según las Unidades de Negocio con las que cuenta QATA como lo es Arquitectura y Construcción.\nBajo la necesidad de que el proveedor de compras, servicios y contrataciones tenga dudas adicionales sobre el fiel cumplimiento de la Normativa Legal vigente, deberá comunicarse con el Supervisor de Seguridad, Salud Ocupacional y Medio Ambiente de sede central QATA.\n28. Indemnidad:\nEl Proveedor se obliga a mantener patrimonialmente indemne a QATA por cualesquiera demanda, reclamación, procedimiento, investigación, sanción, multa, fallo o sentencia condenatoria (referidos conjunta e indistintamente, como los \"reclamos\") que pueda ser instituido, presentado, seguido o pronunciado contra el Proveedor o que, de cualquier forma, pudiera afectar o involucrar a él Proveedor y por cualesquiera pérdida, merma, responsabilidad, daño, costo, cargo, gasto, imposición y, en general, cualesquiera erogación (referidos conjunta e indistintamente, como las \"pérdidas\") que pudiera afectar, gravar, sufrir o en las que pudiera incurrir QATA como consecuencia de la ejecución del presente contrato. En tal sentido, queda expresamente pactado que en caso de que QATA como consecuencia de alguna resolución judicial, arbitral, administrativa o de cualquier otra índole o naturaleza, o si por cualquier circunstancia, incluida una obligación legal, pagare a cualquier tercero por los daños y perjuicios sufridos por éste como consecuencia de los trabajos ejecutados por el Proveedor, este último deberá restituir todo y cualquier monto que QATA hubiera tenido que pagar.\nLa obligación de indemnidad que el Proveedor asume conforme a esta cláusula incluye, cubre y comprende, sin que la enunciación sea limitativa, todas y cualesquiera pérdidas en las que pudiera incurrir o verse afectada QATA como consecuencia de la investigación, preparación, disputa o defensa, o producción de medios y pruebas vinculadas con cualesquiera reclamos en los que QATA resulte involucrado, como parte interviniente bajo cualquier título.\n29. Vínculo laboral:\n-Naturaleza jurídica\nEl presente documento se rige por las normas del Código Civil por lo tanto no genera relación laboral alguna entre QATA y el Proveedor ni con los terceros dependientes de éste. El Proveedor asume total y completa responsabilidad por el personal a su cargo.\n-Contratación del personal\nEl Proveedor es responsable de la contratación de todo su personal, así como de los pagos, alojamiento, alimentación y transporte de los mismos, en caso de ser estos requeridos. El Proveedor cumplirá con todas las leyes, reglamentaciones o disposiciones laborales aplicables a la materia.\n30. Limitación de Responsabilidad:\nEn ningún caso QATA responderá ante el Proveedor por lucro cesante o cualquier pérdida de ganancias, pérdida de uso, alquileres, leasings, pérdida de producción, pérdida de contratos, pérdida de ahorros u otra forma indirecta de pérdida o perjuicio que pueda padecer, en virtud de cualquier materia vinculada al Subcontrato, ya sea que tales pérdidas se hubieran causado por violación del contrato, hecho ilícito civil, culpa u otro, con excepción de toda pérdida o perjuicio que surja de acción u omisión dolosa por parte de QATA."
}
$json$::jsonb,
  now()
)
on conflict(bucket,id) do nothing;

commit;

-- ============================================================
-- SIGUIENTE PASO (después de crear tu usuario en Authentication):
-- select public.qata_grant_admin('TU_CORREO_AQUI');
-- ============================================================
-- ============================================================
-- QATA ERP — ACTUALIZACIÓN DE ROLES Y PERMISOS
-- Ejecutar UNA SOLA VEZ después de INSTALAR-QATA-SUPABASE.sql
-- Roles: admin, comprador, admin_obra
-- ============================================================

begin;

-- Normaliza perfiles antiguos "editor" al nuevo rol de Administrador de Obra.
update public.qata_documents
set data = jsonb_set(data, '{rol}', '"admin_obra"'::jsonb, true),
    updated_at = now()
where bucket='usuarios'
  and lower(coalesce(data->>'rol',''))='editor';

-- Lectura por rol y por módulo.
drop policy if exists qata_documents_select on public.qata_documents;
create policy qata_documents_select
on public.qata_documents for select
to authenticated
using (
  public.qata_current_role()='admin'
  or (
    public.qata_current_role()='comprador'
    and (
      bucket in ('configuracion','productos','requerimientos','ordenesCompra','ordenesServicio','guiasRemision','proveedores')
      or (bucket='usuarios' and id=auth.uid()::text)
    )
  )
  or (
    public.qata_current_role()='admin_obra'
    and (
      bucket in ('configuracion','productos','requerimientos','ordenesCompra')
      or (bucket='usuarios' and id=auth.uid()::text)
    )
  )
);

-- Escritura: admin todo; comprador módulos operativos; admin_obra solo requerimientos.
drop policy if exists qata_documents_insert on public.qata_documents;
create policy qata_documents_insert
on public.qata_documents for insert
to authenticated
with check (
  public.qata_current_role()='admin'
  or (
    public.qata_current_role()='comprador'
    and bucket in ('productos','requerimientos','ordenesCompra','ordenesServicio','guiasRemision','proveedores')
  )
  or (
    public.qata_current_role()='admin_obra'
    and bucket='requerimientos'
  )
);

drop policy if exists qata_documents_update on public.qata_documents;
create policy qata_documents_update
on public.qata_documents for update
to authenticated
using (
  public.qata_current_role()='admin'
  or (
    public.qata_current_role()='comprador'
    and bucket in ('productos','requerimientos','ordenesCompra','ordenesServicio','guiasRemision','proveedores')
  )
  or (
    public.qata_current_role()='admin_obra'
    and bucket='requerimientos'
  )
)
with check (
  public.qata_current_role()='admin'
  or (
    public.qata_current_role()='comprador'
    and bucket in ('productos','requerimientos','ordenesCompra','ordenesServicio','guiasRemision','proveedores')
  )
  or (
    public.qata_current_role()='admin_obra'
    and bucket='requerimientos'
  )
);

drop policy if exists qata_documents_delete on public.qata_documents;
create policy qata_documents_delete
on public.qata_documents for delete
to authenticated
using (
  public.qata_current_role()='admin'
  or (
    public.qata_current_role()='comprador'
    and bucket in ('productos','requerimientos','ordenesCompra','ordenesServicio','guiasRemision','proveedores')
  )
  or (
    public.qata_current_role()='admin_obra'
    and bucket='requerimientos'
  )
);

-- Comprador puede emitir correlativos operativos, pero solo admin puede configurarlos.
create or replace function public.qata_next_sequence(p_type text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_type text := upper(trim(coalesce(p_type,'')));
  v_seq public.qata_sequences%rowtype;
  v_number bigint;
  v_result text;
  v_bucket text;
  v_field text;
  v_exists boolean;
begin
  v_role := public.qata_current_role();
  if v_role not in ('admin','comprador') then
    raise exception 'ROL_NO_PUEDE_EMITIR_CORRELATIVOS';
  end if;

  if v_type not in ('OC','OS','GUIA') then
    raise exception 'TIPO_CORRELATIVO_INVALIDO';
  end if;

  select * into v_seq
  from public.qata_sequences
  where document_type=v_type
  for update;

  if not found then raise exception 'CORRELATIVO_NO_CONFIGURADO'; end if;

  v_number := v_seq.next_number;
  v_bucket := case v_type when 'OC' then 'ordenesCompra' when 'OS' then 'ordenesServicio' else 'guiasRemision' end;
  v_field := case v_type when 'OC' then 'nroOC' when 'OS' then 'nroOS' else 'nroGR' end;

  loop
    v_result := v_seq.prefix || lpad(v_number::text, v_seq.padding, '0') || v_seq.suffix;
    select exists(
      select 1 from public.qata_documents d
      where d.bucket=v_bucket and d.data->>v_field=v_result
    ) into v_exists;
    exit when not v_exists;
    v_number := v_number + 1;
  end loop;

  update public.qata_sequences
  set next_number=v_number+1, updated_at=now()
  where document_type=v_type;

  return v_result;
end;
$$;

revoke all on function public.qata_next_sequence(text) from public;
grant execute on function public.qata_next_sequence(text) to authenticated;

-- Asignar/actualizar rol desde Administración. El usuario debe existir antes en Authentication > Users.
create or replace function public.qata_set_user_role(p_email text, p_role text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_id uuid;
  v_role text := lower(trim(coalesce(p_role,'')));
  v_email text := lower(trim(coalesce(p_email,'')));
begin
  if public.qata_current_role() <> 'admin' then
    raise exception 'SOLO_ADMIN_PUEDE_ASIGNAR_ROLES';
  end if;

  if v_role not in ('admin','comprador','admin_obra') then
    raise exception 'ROL_INVALIDO';
  end if;

  select id into v_id
  from auth.users
  where lower(email)=v_email
  limit 1;

  if v_id is null then raise exception 'USUARIO_AUTH_NO_ENCONTRADO'; end if;

  insert into public.qata_documents(bucket,id,data,updated_at)
  values(
    'usuarios',
    v_id::text,
    jsonb_build_object('rol',v_role,'email',v_email),
    now()
  )
  on conflict(bucket,id) do update set
    data=public.qata_documents.data || excluded.data,
    updated_at=now();

  return jsonb_build_object('id',v_id::text,'email',v_email,'rol',v_role);
end;
$$;

revoke all on function public.qata_set_user_role(text,text) from public, anon;
grant execute on function public.qata_set_user_role(text,text) to authenticated;

commit;


-- CAPA FINAL DE PERMISOS PERSONALIZADOS (idempotente)
-- ============================================================
-- QATA ERP — PERMISOS PERSONALIZADOS POR USUARIO
-- Ejecutar UNA SOLA VEZ sobre el Supabase ya instalado.
-- El rol define la plantilla inicial, pero el Administrador principal puede
-- agregar o quitar módulos individualmente desde Administración / Configuración.
-- ============================================================

begin;

create or replace function public.qata_default_modules(p_role text)
returns jsonb
language sql
immutable
as $$
  select case lower(trim(coalesce(p_role,'')))
    when 'admin' then '["dashboard","rq_create","rq_history","products","oc_create","oc_history","os_create","os_history","guide_create","guide_history","admin_config"]'::jsonb
    when 'comprador' then '["dashboard","rq_create","rq_history","products","oc_create","oc_history","os_create","os_history","guide_create","guide_history"]'::jsonb
    when 'admin_obra' then '["rq_create","rq_history","guide_history","os_history","products"]'::jsonb
    when 'editor' then '["rq_create","rq_history","guide_history","os_history","products"]'::jsonb
    else '[]'::jsonb
  end;
$$;

create or replace function public.qata_current_modules()
returns jsonb
language sql
stable
security definer
set search_path=public
as $$
  select case
    when lower(coalesce(d.data->>'rol',''))='admin' then public.qata_default_modules('admin')
    when jsonb_typeof(d.data->'modulos')='array' then d.data->'modulos'
    else public.qata_default_modules(d.data->>'rol')
  end
  from public.qata_documents d
  where d.bucket='usuarios' and d.id=auth.uid()::text
  limit 1;
$$;

create or replace function public.qata_has_module(p_module text)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select coalesce(public.qata_current_role()='admin',false)
      or coalesce(public.qata_current_modules(),'[]'::jsonb) ? trim(coalesce(p_module,''));
$$;

revoke all on function public.qata_default_modules(text) from public,anon;
revoke all on function public.qata_current_modules() from public,anon;
revoke all on function public.qata_has_module(text) from public,anon;
grant execute on function public.qata_default_modules(text) to authenticated;
grant execute on function public.qata_current_modules() to authenticated;
grant execute on function public.qata_has_module(text) to authenticated;

-- Lectura real por módulo. Configuración base se puede leer para completar formularios.
drop policy if exists qata_documents_select on public.qata_documents;
create policy qata_documents_select
on public.qata_documents for select
to authenticated
using (
  public.qata_current_role()='admin'
  or (bucket='usuarios' and id=auth.uid()::text)
  or (bucket='configuracion' and public.qata_current_role() in ('comprador','admin_obra','editor'))
  or (bucket='productos' and (public.qata_has_module('products') or public.qata_has_module('rq_create') or public.qata_has_module('oc_create') or public.qata_has_module('guide_create')))
  or (bucket='requerimientos' and (public.qata_has_module('rq_create') or public.qata_has_module('rq_history') or public.qata_has_module('dashboard')))
  or (bucket='ordenesCompra' and (public.qata_has_module('oc_create') or public.qata_has_module('oc_history') or public.qata_has_module('dashboard')))
  or (bucket='ordenesServicio' and (public.qata_has_module('os_create') or public.qata_has_module('os_history') or public.qata_has_module('dashboard')))
  or (bucket='guiasRemision' and (public.qata_has_module('guide_create') or public.qata_has_module('guide_history') or public.qata_has_module('dashboard')))
  or (bucket='proveedores' and (public.qata_has_module('oc_create') or public.qata_has_module('os_create')))
);

-- Crear documentos solo cuando el módulo de creación correspondiente está habilitado.
drop policy if exists qata_documents_insert on public.qata_documents;
create policy qata_documents_insert
on public.qata_documents for insert
to authenticated
with check (
  public.qata_current_role()='admin'
  or (bucket='configuracion' and public.qata_has_module('admin_config'))
  or (bucket='productos' and (public.qata_has_module('products') or public.qata_has_module('rq_create') or public.qata_has_module('oc_create') or public.qata_has_module('guide_create')))
  or (bucket='requerimientos' and public.qata_has_module('rq_create'))
  or (bucket='ordenesCompra' and public.qata_has_module('oc_create'))
  or (bucket='ordenesServicio' and public.qata_has_module('os_create'))
  or (bucket='guiasRemision' and public.qata_has_module('guide_create'))
  or (bucket='proveedores' and (public.qata_has_module('oc_create') or public.qata_has_module('os_create')))
);

drop policy if exists qata_documents_update on public.qata_documents;
create policy qata_documents_update
on public.qata_documents for update
to authenticated
using (
  public.qata_current_role()='admin'
  or (bucket='configuracion' and public.qata_has_module('admin_config'))
  or (bucket='productos' and (public.qata_has_module('products') or public.qata_has_module('rq_create') or public.qata_has_module('oc_create') or public.qata_has_module('guide_create')))
  or (bucket='requerimientos' and public.qata_has_module('rq_create'))
  or (bucket='ordenesCompra' and public.qata_has_module('oc_create'))
  or (bucket='ordenesServicio' and public.qata_has_module('os_create'))
  or (bucket='guiasRemision' and public.qata_has_module('guide_create'))
  or (bucket='proveedores' and (public.qata_has_module('oc_create') or public.qata_has_module('os_create')))
)
with check (
  public.qata_current_role()='admin'
  or (bucket='configuracion' and public.qata_has_module('admin_config'))
  or (bucket='productos' and (public.qata_has_module('products') or public.qata_has_module('rq_create') or public.qata_has_module('oc_create') or public.qata_has_module('guide_create')))
  or (bucket='requerimientos' and public.qata_has_module('rq_create'))
  or (bucket='ordenesCompra' and public.qata_has_module('oc_create'))
  or (bucket='ordenesServicio' and public.qata_has_module('os_create'))
  or (bucket='guiasRemision' and public.qata_has_module('guide_create'))
  or (bucket='proveedores' and (public.qata_has_module('oc_create') or public.qata_has_module('os_create')))
);

-- Mantiene eliminación de productos fuera de Administrador de Obra.
drop policy if exists qata_documents_delete on public.qata_documents;
create policy qata_documents_delete
on public.qata_documents for delete
to authenticated
using (
  public.qata_current_role()='admin'
  or (bucket='productos' and public.qata_has_module('products') and public.qata_current_role()='comprador')
  or (bucket='requerimientos' and public.qata_has_module('rq_create'))
  or (bucket='ordenesCompra' and public.qata_has_module('oc_create'))
  or (bucket='ordenesServicio' and public.qata_has_module('os_create'))
  or (bucket='guiasRemision' and public.qata_has_module('guide_create'))
  or (bucket='proveedores' and (public.qata_has_module('oc_create') or public.qata_has_module('os_create')))
);

-- Los correlativos se pueden consultar/configurar si el usuario tiene Administración / Configuración.
drop policy if exists qata_sequences_select on public.qata_sequences;
create policy qata_sequences_select
on public.qata_sequences for select
to authenticated
using (public.qata_has_module('admin_config'));

create or replace function public.qata_next_sequence(p_type text)
returns text
language plpgsql
security definer
set search_path=public
as $$
declare
  v_type text := upper(trim(coalesce(p_type,'')));
  v_seq public.qata_sequences%rowtype;
  v_number bigint;
  v_result text;
  v_bucket text;
  v_field text;
  v_exists boolean;
  v_module text;
begin
  if v_type not in ('OC','OS','GUIA') then raise exception 'TIPO_CORRELATIVO_INVALIDO'; end if;
  v_module := case v_type when 'OC' then 'oc_create' when 'OS' then 'os_create' else 'guide_create' end;
  if not public.qata_has_module(v_module) then raise exception 'MODULO_NO_AUTORIZADO'; end if;

  select * into v_seq from public.qata_sequences where document_type=v_type for update;
  if not found then raise exception 'CORRELATIVO_NO_CONFIGURADO'; end if;

  v_number:=v_seq.next_number;
  v_bucket:=case v_type when 'OC' then 'ordenesCompra' when 'OS' then 'ordenesServicio' else 'guiasRemision' end;
  v_field:=case v_type when 'OC' then 'nroOC' when 'OS' then 'nroOS' else 'nroGR' end;
  loop
    v_result:=v_seq.prefix||lpad(v_number::text,v_seq.padding,'0')||v_seq.suffix;
    select exists(select 1 from public.qata_documents d where d.bucket=v_bucket and d.data->>v_field=v_result) into v_exists;
    exit when not v_exists;
    v_number:=v_number+1;
  end loop;
  update public.qata_sequences set next_number=v_number+1,updated_at=now() where document_type=v_type;
  return v_result;
end;
$$;
revoke all on function public.qata_next_sequence(text) from public,anon;
grant execute on function public.qata_next_sequence(text) to authenticated;

create or replace function public.qata_set_sequence(p_type text,p_prefix text,p_suffix text,p_next_number bigint,p_padding integer)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare v_type text:=upper(trim(coalesce(p_type,'')));
begin
  if not public.qata_has_module('admin_config') then raise exception 'MODULO_ADMINISTRACION_NO_AUTORIZADO'; end if;
  if v_type not in ('OC','OS','GUIA') then raise exception 'TIPO_CORRELATIVO_INVALIDO'; end if;
  if coalesce(p_next_number,0)<1 then raise exception 'PROXIMO_NUMERO_INVALIDO'; end if;
  if coalesce(p_padding,0)<1 or p_padding>12 then raise exception 'DIGITOS_INVALIDOS'; end if;
  insert into public.qata_sequences(document_type,prefix,suffix,next_number,padding,updated_at)
  values(v_type,coalesce(p_prefix,''),coalesce(p_suffix,''),p_next_number,p_padding,now())
  on conflict(document_type) do update set prefix=excluded.prefix,suffix=excluded.suffix,next_number=excluded.next_number,padding=excluded.padding,updated_at=now();
  return jsonb_build_object('document_type',v_type,'preview',coalesce(p_prefix,'')||lpad(p_next_number::text,p_padding,'0')||coalesce(p_suffix,''),'next_number',p_next_number);
end;
$$;
revoke all on function public.qata_set_sequence(text,text,text,bigint,integer) from public,anon;
grant execute on function public.qata_set_sequence(text,text,text,bigint,integer) to authenticated;

-- El Administrador principal puede asignar un rol y una lista personalizada de módulos.
create or replace function public.qata_set_user_access(p_email text,p_role text,p_modules jsonb default null)
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_id uuid;
  v_role text:=lower(trim(coalesce(p_role,'')));
  v_email text:=lower(trim(coalesce(p_email,'')));
  v_modules jsonb;
  v_allowed text[]:=array['dashboard','rq_create','rq_history','products','oc_create','oc_history','os_create','os_history','guide_create','guide_history','admin_config'];
  v_bad boolean;
begin
  if public.qata_current_role()<>'admin' then raise exception 'SOLO_ADMIN_PUEDE_ASIGNAR_PERMISOS'; end if;
  if v_role='editor' then v_role:='admin_obra'; end if;
  if v_role not in ('admin','comprador','admin_obra') then raise exception 'ROL_INVALIDO'; end if;
  select id into v_id from auth.users where lower(email)=v_email limit 1;
  if v_id is null then raise exception 'USUARIO_AUTH_NO_ENCONTRADO'; end if;

  if v_role='admin' then
    v_modules:=public.qata_default_modules('admin');
  elsif p_modules is null then
    v_modules:=public.qata_default_modules(v_role);
  else
    if jsonb_typeof(p_modules)<>'array' then raise exception 'MODULOS_INVALIDOS'; end if;
    select exists(select 1 from jsonb_array_elements_text(p_modules) as x(value) where not (x.value=any(v_allowed))) into v_bad;
    if v_bad then raise exception 'MODULO_INVALIDO'; end if;
    select coalesce(jsonb_agg(distinct x.value),'[]'::jsonb) into v_modules from jsonb_array_elements_text(p_modules) as x(value);
  end if;

  insert into public.qata_documents(bucket,id,data,updated_at)
  values('usuarios',v_id::text,jsonb_build_object('rol',v_role,'email',v_email,'modulos',v_modules,'permisos_personalizados',true),now())
  on conflict(bucket,id) do update set data=public.qata_documents.data || excluded.data,updated_at=now();
  return jsonb_build_object('id',v_id::text,'email',v_email,'rol',v_role,'modulos',v_modules);
end;
$$;
revoke all on function public.qata_set_user_access(text,text,jsonb) from public,anon;
grant execute on function public.qata_set_user_access(text,text,jsonb) to authenticated;

-- Compatibilidad: asignar solo rol restaura la plantilla predeterminada.
create or replace function public.qata_set_user_role(p_email text,p_role text)
returns jsonb
language sql
security definer
set search_path=public
as $$ select public.qata_set_user_access(p_email,p_role,null); $$;
revoke all on function public.qata_set_user_role(text,text) from public,anon;
grant execute on function public.qata_set_user_role(text,text) to authenticated;

commit;

