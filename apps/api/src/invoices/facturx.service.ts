import { Injectable } from '@nestjs/common'
import { Decimal } from '@prisma/client/runtime/library'

// Génère le XML Factur-X (profil MINIMUM EN16931)
// Standard EU pour la facturation électronique B2B
// Deadline France: septembre 2026 (Plateforme Agréée)

@Injectable()
export class FacturxService {
  generate(order: any): string {
    const settings = order.site?.organization?.settings
    const issueDate = this.formatDate(order.invoicedAt ?? order.createdAt)
    const dueDate = order.paymentTerms
      ? this.formatDate(
          new Date(
            new Date(order.invoicedAt ?? order.createdAt).getTime() +
              order.paymentTerms * 86_400_000,
          ),
        )
      : issueDate

    let subtotal = new Decimal(0)
    let taxTotal = new Decimal(0)

    const lines = (order.items ?? []).map((item: any, i: number) => {
      const lineHT = new Decimal(item.price).mul(item.quantity)
      const lineTax = lineHT.mul(new Decimal(item.taxRate)).div(100)
      subtotal = subtotal.add(lineHT)
      taxTotal = taxTotal.add(lineTax)

      return `
    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument>
        <ram:LineID>${i + 1}</ram:LineID>
      </ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct>
        <ram:Name>${this.esc(item.name)}</ram:Name>
      </ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement>
        <ram:NetPriceProductTradePrice>
          <ram:ChargeAmount>${this.dec(item.price)}</ram:ChargeAmount>
        </ram:NetPriceProductTradePrice>
      </ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery>
        <ram:BilledQuantity unitCode="C62">${item.quantity}</ram:BilledQuantity>
      </ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax>
          <ram:TypeCode>VAT</ram:TypeCode>
          <ram:CategoryCode>S</ram:CategoryCode>
          <ram:RateApplicablePercent>${this.dec(item.taxRate)}</ram:RateApplicablePercent>
        </ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation>
          <ram:LineTotalAmount>${this.dec(lineHT)}</ram:LineTotalAmount>
        </ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>`
    })

    const grandTotal = subtotal.add(taxTotal)

    return `<?xml version="1.0" encoding="UTF-8"?>
<!-- Factur-X MINIMUM — EN16931 — ERP Luxury Food -->
<rsm:CrossIndustryInvoice
  xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
  xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">

  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>urn:factur-x.eu:1p0:minimum</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>

  <rsm:ExchangedDocument>
    <ram:ID>${this.esc(order.invoiceNumber)}</ram:ID>
    <ram:TypeCode>380</ram:TypeCode><!-- 380 = Facture commerciale -->
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">${issueDate}</udt:DateTimeString>
    </ram:IssueDateTime>
  </rsm:ExchangedDocument>

  <rsm:SupplyChainTradeTransaction>
    <!-- Lignes de facturation -->
    ${lines.join('\n')}

    <ram:ApplicableHeaderTradeAgreement>

      <!-- Vendeur -->
      <ram:SellerTradeParty>
        <ram:Name>${this.esc(order.site?.organization?.name ?? '')}</ram:Name>
        ${settings?.siret ? `<ram:SpecifiedLegalOrganization>
          <ram:ID schemeID="0002">${this.esc(settings.siret)}</ram:ID>
        </ram:SpecifiedLegalOrganization>` : ''}
        ${settings?.vatNumber ? `<ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="VA">${this.esc(settings.vatNumber)}</ram:ID>
        </ram:SpecifiedTaxRegistration>` : ''}
        ${settings?.legalAddress ? `<ram:PostalTradeAddress>
          ${settings.legalZipCode ? `<ram:PostcodeCode>${this.esc(settings.legalZipCode)}</ram:PostcodeCode>` : ''}
          <ram:LineOne>${this.esc(settings.legalAddress)}</ram:LineOne>
          ${settings.legalCity ? `<ram:CityName>${this.esc(settings.legalCity)}</ram:CityName>` : ''}
          <ram:CountryID>FR</ram:CountryID>
        </ram:PostalTradeAddress>` : ''}
      </ram:SellerTradeParty>

      <!-- Acheteur -->
      <ram:BuyerTradeParty>
        <ram:Name>${this.esc(order.b2bClient?.name ?? 'Client B2B')}</ram:Name>
        ${order.b2bClient?.siret ? `<ram:SpecifiedLegalOrganization>
          <ram:ID schemeID="0002">${this.esc(order.b2bClient.siret)}</ram:ID>
        </ram:SpecifiedLegalOrganization>` : ''}
        ${order.b2bClient?.vatNumber ? `<ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="VA">${this.esc(order.b2bClient.vatNumber)}</ram:ID>
        </ram:SpecifiedTaxRegistration>` : ''}
      </ram:BuyerTradeParty>

    </ram:ApplicableHeaderTradeAgreement>

    <ram:ApplicableHeaderTradeDelivery/>

    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>

      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>${this.dec(taxTotal)}</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>
        <ram:BasisAmount>${this.dec(subtotal)}</ram:BasisAmount>
        <ram:CategoryCode>S</ram:CategoryCode>
      </ram:ApplicableTradeTax>

      ${order.paymentTerms ? `<ram:SpecifiedTradePaymentTerms>
        <ram:DueDateDateTime>
          <udt:DateTimeString format="102">${dueDate}</udt:DateTimeString>
        </ram:DueDateDateTime>
        <ram:Description>Paiement ${order.paymentTerms === 0 ? 'comptant' : `à ${order.paymentTerms} jours`}</ram:Description>
      </ram:SpecifiedTradePaymentTerms>` : ''}

      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:TaxBasisTotalAmount>${this.dec(subtotal)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="EUR">${this.dec(taxTotal)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${this.dec(grandTotal)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${this.dec(grandTotal)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>

    </ram:ApplicableHeaderTradeSettlement>

  </rsm:SupplyChainTradeTransaction>

</rsm:CrossIndustryInvoice>`
  }

  private formatDate(date: Date | string): string {
    const d = new Date(date)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}${m}${day}`
  }

  private dec(value: Decimal | number | string): string {
    return Number(value).toFixed(2)
  }

  private esc(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }
}
