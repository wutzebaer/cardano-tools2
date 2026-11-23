import { PageHeader } from "@components/ui";
import Link from "next/link";
import { CONTACT_EMAIL, LegalHeading, LegalText } from "../Legal";

export const metadata = { title: "Datenschutz · Cardano Tools" };

export default function Page() {
  return (
    <>
      <PageHeader title="Datenschutzerklärung" />
      <LegalText lang="de">
        <p>Cardano Tools kommt ohne Benutzerkonto, ohne Cookies und ohne Tracking aus. Diese Seite erklärt, welche Daten trotzdem anfallen.</p>

        <LegalHeading>Verantwortlicher</LegalHeading>
        <p>
          Peter Großmann, Anschrift siehe{" "}
          <Link className="link" href="/legal/imprint">
            Impressum
          </Link>
          , E-Mail{" "}
          <a className="link" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
          .
        </p>

        <LegalHeading>Aufruf der Seite</LegalHeading>
        <p>
          Die Seite läuft auf einem Server der Hetzner Online GmbH in Deutschland. Bei jedem Aufruf protokolliert der Server IP-Adresse, Zeitpunkt, aufgerufene Adresse und die Kennung des Browsers. Die Protokolle dienen dem sicheren Betrieb und der Fehlersuche (Art. 6 Abs. 1 lit. f DSGVO). Sie werden nicht ausgewertet, nicht mit anderen Daten zusammengeführt und automatisch überschrieben, sobald sie eine feste Größe erreichen.
        </p>

        <LegalHeading>Wallet und Blockchain-Daten</LegalHeading>
        <p>
          Wer ein Wallet verbindet oder eine Adresse eingibt, schickt diese Adresse an den Server der Seite, damit er die zugehörigen Token, Transaktionen und Belohnungen aus der öffentlichen Cardano-Blockchain abfragen kann. Die Abfragen werden nicht dauerhaft gespeichert und keinem Nutzer zugeordnet. Private Schlüssel des Wallets verlassen das Wallet nie; jede Transaktion wird dort einzeln bestätigt.
        </p>
        <p>
          Transaktionen, die über diese Seite erstellt werden, stehen wie alle Transaktionen öffentlich und dauerhaft auf der Blockchain. Sie lassen sich weder ändern noch löschen. Zum Absenden wird die signierte Transaktion an den öffentlichen Dienst Koios (api.koios.rest) übergeben; sie enthält keine Angaben, die nicht ohnehin auf der Blockchain erscheinen.
        </p>

        <LegalHeading>Hochgeladene Dateien</LegalHeading>
        <p>
          Bilder und andere Dateien, die beim Minten hochgeladen werden, werden im IPFS-Netzwerk veröffentlicht. Sie sind damit öffentlich abrufbar und können von anderen Teilnehmern des Netzwerks kopiert werden; eine zuverlässige Löschung ist nicht möglich. Laden Sie deshalb keine Dateien hoch, die personenbezogene Daten enthalten.
        </p>

        <LegalHeading>Speicher des Browsers</LegalHeading>
        <p>
          Die Seite legt einige Angaben im lokalen Speicher Ihres Browsers ab: das zuletzt gewählte Wallet, die von Ihnen angelegten oder importierten Minting-Policies (bei importierten samt Signaturschlüssel) und die zuletzt für eine Wallet-Aufstellung verwendeten Adressen. Diese Angaben bleiben auf Ihrem Gerät, werden nicht an den Server übertragen und lassen sich über die Einstellungen des Browsers löschen. Cookies setzt die Seite nicht.
        </p>

        <LegalHeading>Dienste Dritter</LegalHeading>
        <p>
          Der Server der Seite ruft Kurse bei Kraken und Angaben zu Token-Sammlungen bei Anvil ab. Dabei werden weder Ihre IP-Adresse noch Ihre Wallet-Adresse übermittelt. Token-Bilder liefert der Server der Seite aus, auch wenn sie ursprünglich aus dem IPFS-Netzwerk oder von anderen Adressen stammen. Die Seite bindet keine Schriften, Skripte oder Statistikdienste anderer Anbieter ein. Erst wenn Sie einem Link zu einer anderen Seite folgen, gelten deren Datenschutzbestimmungen.
        </p>

        <LegalHeading>Kontakt</LegalHeading>
        <p>
          Wenn Sie per E-Mail oder Telegram schreiben, werden Ihre Angaben nur verwendet, um die Anfrage zu beantworten (Art. 6 Abs. 1 lit. f DSGVO), und gelöscht, sobald sie nicht mehr gebraucht werden. Für Telegram gelten zusätzlich die Bestimmungen von Telegram.
        </p>

        <LegalHeading>Ihre Rechte</LegalHeading>
        <p>
          Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung und Datenübertragbarkeit sowie das Recht, einer Verarbeitung zu widersprechen (Art. 15 bis 21 DSGVO). Dazu genügt eine E-Mail an die oben genannte Adresse. Daten auf der Blockchain und im IPFS-Netzwerk liegen außerhalb meines Einflusses und können von mir nicht gelöscht werden. Sie können sich außerdem bei einer Datenschutz-Aufsichtsbehörde beschweren, zum Beispiel beim Hessischen Beauftragten für Datenschutz und Informationsfreiheit.
        </p>

        <p>Stand: 23. November 2026</p>
      </LegalText>
    </>
  );
}
