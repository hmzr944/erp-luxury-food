-- ============================================================
-- Détail des ventes signées en ajout seul.
--
-- Une vente est SIGNÉE quand "Order"."receiptChainId" n'est pas nul : le
-- ticket est alors dans le grand livre (ReceiptChain), et son empreinte de
-- contenu couvre les lignes et les paiements. Pour une telle vente :
--   - "Order" : aucune suppression ; les colonnes fiscales (montants, remise,
--     type, remboursement d'origine, site, canal, mode de paiement, identifiant
--     de caisse, dates de vente, lien au ticket) ne changent plus. Restent
--     modifiables : statut, e-mail et nom du client, note, retrait, rattachement
--     à un client fidélité, points, B2B, facturation, envoi du reçu.
--   - "OrderItem" : aucune suppression ; aucune colonne ne change, sauf
--     "lotId" (traçabilité du lot, pas dans le contenu signé).
--   - "OrderPayment" : aucune suppression ni modification.
-- Les ventes sans ticket (historique antérieur au grand livre) ne sont pas
-- concernées. Ajouter une ligne ou un paiement à une vente déjà signée reste
-- possible au niveau de la base (la création d'une vente insère d'abord la
-- commande), mais la vérification du grand livre le détecte : l'empreinte du
-- contenu est recalculée depuis les lignes.
--
-- Même règle de purge que flow_append_only : suppression seulement dans une
-- transaction qui a posé SET LOCAL flow.allow_purge = 'on' (après archivage).
-- Les suppressions en cascade (lignes et paiements d'une commande) suivent la
-- même règle : refusées pour une vente signée, permises en purge. Le lien
-- vers le ticket mis à nul par la purge du grand livre est permis en purge.
-- Une organisation ou un site qui a des ventes ne peut pas être supprimé
-- (clés étrangères en RESTRICT) : aucune cascade ne peut effacer une vente.
-- ============================================================

CREATE OR REPLACE FUNCTION flow_order_append_only() RETURNS trigger AS $$
DECLARE
  purge boolean := coalesce(current_setting('flow.allow_purge', true), '') = 'on';
  changed text;
BEGIN
  -- Vente sans ticket : pas concernée
  IF OLD."receiptChainId" IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF purge THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'Vente signée en ajout seul : suppression refusée (commande %)', OLD."id"
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT string_agg(o.key, ', ' ORDER BY o.key) INTO changed
  FROM jsonb_each(jsonb_build_object(
         'id', OLD."id", 'kind', OLD."kind", 'refundOfId', OLD."refundOfId", 'refundReason', OLD."refundReason",
         'siteId', OLD."siteId", 'channel', OLD."channel", 'subtotal', OLD."subtotal", 'taxAmount', OLD."taxAmount",
         'total', OLD."total", 'discount', OLD."discount", 'paymentMode', OLD."paymentMode", 'clientId', OLD."clientId",
         'soldAt', OLD."soldAt", 'createdAt', OLD."createdAt", 'receiptChainId', OLD."receiptChainId")) o
  JOIN jsonb_each(jsonb_build_object(
         'id', NEW."id", 'kind', NEW."kind", 'refundOfId', NEW."refundOfId", 'refundReason', NEW."refundReason",
         'siteId', NEW."siteId", 'channel', NEW."channel", 'subtotal', NEW."subtotal", 'taxAmount', NEW."taxAmount",
         'total', NEW."total", 'discount', NEW."discount", 'paymentMode', NEW."paymentMode", 'clientId', NEW."clientId",
         'soldAt', NEW."soldAt", 'createdAt', NEW."createdAt", 'receiptChainId', NEW."receiptChainId")) n
    ON o.key = n.key
  WHERE o.value IS DISTINCT FROM n.value;

  IF changed IS NULL THEN RETURN NEW; END IF;

  -- Purge du grand livre : la clé étrangère met le lien au ticket à nul
  IF purge AND changed = 'receiptChainId' AND NEW."receiptChainId" IS NULL THEN RETURN NEW; END IF;

  RAISE EXCEPTION 'Vente signée en ajout seul : modification refusée (commande %, colonnes %)', OLD."id", changed
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

-- Lignes et paiements : verrouillés dès que la commande est signée.
-- Colonnes encore modifiables, passées en argument du trigger.
CREATE OR REPLACE FUNCTION flow_order_child_append_only() RETURNS trigger AS $$
DECLARE
  purge boolean := coalesce(current_setting('flow.allow_purge', true), '') = 'on';
  chain text;
  new_chain text;
  allowed text[] := coalesce(TG_ARGV, ARRAY[]::text[]);
  changed text;
BEGIN
  SELECT "receiptChainId" INTO chain FROM "Order" WHERE "id" = OLD."orderId";
  IF TG_OP = 'UPDATE' AND NEW."orderId" IS DISTINCT FROM OLD."orderId" THEN
    SELECT "receiptChainId" INTO new_chain FROM "Order" WHERE "id" = NEW."orderId";
  END IF;

  -- Commande sans ticket (ou déjà supprimée dans la même instruction) : pas concernée
  IF chain IS NULL AND new_chain IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF purge THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'Vente signée en ajout seul : suppression refusée (% de la commande %)', TG_TABLE_NAME, OLD."orderId"
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT string_agg(o.key, ', ' ORDER BY o.key) INTO changed
  FROM jsonb_each(to_jsonb(OLD)) o
  JOIN jsonb_each(to_jsonb(NEW)) n ON o.key = n.key
  WHERE o.value IS DISTINCT FROM n.value AND NOT (o.key = ANY (allowed));

  IF changed IS NULL THEN RETURN NEW; END IF;

  RAISE EXCEPTION 'Vente signée en ajout seul : modification refusée (% de la commande %, colonnes %)', TG_TABLE_NAME, OLD."orderId", changed
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER order_append_only BEFORE UPDATE OR DELETE ON "Order"
  FOR EACH ROW EXECUTE FUNCTION flow_order_append_only();
CREATE TRIGGER order_item_append_only BEFORE UPDATE OR DELETE ON "OrderItem"
  FOR EACH ROW EXECUTE FUNCTION flow_order_child_append_only('lotId');
CREATE TRIGGER order_payment_append_only BEFORE UPDATE OR DELETE ON "OrderPayment"
  FOR EACH ROW EXECUTE FUNCTION flow_order_child_append_only();
