import React from 'react';

// Current terms version - increment this when terms change
export const TERMS_VERSION = 'beta-1.1';
export const TERMS_LAST_UPDATED = '28. November 2025';

export default function TermsAndConditions({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      zIndex: 2000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'var(--login-panel-bg, #1a1a2e)',
        borderRadius: '12px',
        maxWidth: '800px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        color: 'var(--login-text-primary, #fff)'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--login-border, #333)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px' }}>
              Nutzungsbedingungen und Datenschutzerklärung
            </h2>
            <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: 'var(--login-text-secondary, #888)' }}>
              Version {TERMS_VERSION} | Stand: {TERMS_LAST_UPDATED}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--login-text-primary, #fff)',
              fontSize: '24px',
              cursor: 'pointer',
              padding: '5px'
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{
          padding: '24px',
          overflowY: 'auto',
          flex: 1,
          fontSize: '14px',
          lineHeight: '1.6'
        }}>
          <TermsContent />
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid var(--login-border, #333)',
          textAlign: 'right',
          flexShrink: 0
        }}>
          <button
            onClick={onClose}
            style={{
              backgroundColor: 'var(--button-success-bg, #4CAF50)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '10px 24px',
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            Schliessen
          </button>
        </div>
      </div>
    </div>
  );
}

export function TermsContent() {
  return (
    <div className="terms-content">
      <section style={{ marginBottom: '24px' }}>
        <h3 style={{ color: 'var(--login-text-primary, #fff)', marginBottom: '12px', fontSize: '16px' }}>
          1. Geltungsbereich und Vertragspartner
        </h3>
        <p>
          Diese Nutzungsbedingungen und Datenschutzerklärung (nachfolgend «AGB») regeln die Nutzung 
          der Webanwendung «Ancestree» (nachfolgend «Dienst» oder «Plattform»), erreichbar unter ancestree.ch.
        </p>
        <p style={{ marginTop: '8px' }}>
          Betreiber des Dienstes:<br />
          E-Mail: <a href="mailto:m.erler@gmx.ch" style={{ color: '#4CAF50' }}>m.erler@gmx.ch</a>
        </p>
        <p style={{ marginTop: '8px' }}>
          Anwendbares Recht und Gerichtsstand: Es gilt schweizerisches Recht. 
          Gerichtsstand ist Zürich, Schweiz.
        </p>
      </section>

      <section style={{ marginBottom: '24px' }}>
        <h3 style={{ color: 'var(--login-text-primary, #fff)', marginBottom: '12px', fontSize: '16px' }}>
          2. Beta-Status und Haftungsausschluss
        </h3>
        <p>
          <strong>Der Dienst befindet sich derzeit in einer offenen Beta-Testphase.</strong> Die Dauer 
          der Beta-Phase ist unbefristet.
        </p>
        <p style={{ marginTop: '8px' }}>
          Der Dienst wird «wie besehen» («as is») ohne jegliche Garantien bereitgestellt. 
          Der Betreiber übernimmt insbesondere keine Gewährleistung für:
        </p>
        <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
          <li>Die Verfügbarkeit, Zuverlässigkeit oder Stabilität des Dienstes</li>
          <li>Die Erhaltung oder Sicherheit der gespeicherten Daten</li>
          <li>Die Fehlerfreiheit der Software</li>
          <li>Datenverluste jeglicher Art</li>
        </ul>
        <p style={{ marginTop: '8px' }}>
          <strong>Es wird ausdrücklich keine Garantie für die Datenerhaltung gegeben.</strong> Nutzer 
          sollten eigenständig Sicherungskopien ihrer Daten erstellen.
        </p>
        <p style={{ marginTop: '8px' }}>
          Der vollständige Quellcode ist öffentlich einsehbar unter:{' '}
          <a 
            href="https://github.com/Mdmdma/ancestree" 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ color: '#4CAF50' }}
          >
            https://github.com/Mdmdma/ancestree
          </a>
        </p>
        <p style={{ marginTop: '8px' }}>
          Die Software ist unter der <strong>GNU General Public License Version 2 (GPL-2)</strong> lizenziert.
        </p>
      </section>

      <section style={{ marginBottom: '24px' }}>
        <h3 style={{ color: 'var(--login-text-primary, #fff)', marginBottom: '12px', fontSize: '16px' }}>
          3. Funktionsweise und Datenteilung
        </h3>
        <p>
          <strong>Wichtiger Hinweis:</strong> Der Dienst basiert auf einem gemeinsamen Familienkonto-Modell. 
          Dies bedeutet:
        </p>
        <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
          <li>
            Ein Familienpasswort wird von allen Familienmitgliedern geteilt, die Zugang zum 
            Stammbaum haben sollen.
          </li>
          <li>
            <strong>Alle Personen, die das Passwort kennen, haben vollständigen Zugriff auf sämtliche 
            im Familienkonto gespeicherten Daten</strong>, einschliesslich personenbezogener Daten 
            aller im Stammbaum erfassten Personen und aller hochgeladenen Bilder.
          </li>
          <li>
            Der Zugang kann nur durch Änderung des Passworts widerrufen werden. Personen, 
            denen das alte Passwort bekannt war, haben nach einer Passwortänderung keinen 
            Zugriff mehr.
          </li>
          <li>
            <strong>Eine Passwortwiederherstellung ist nicht möglich</strong>, da das Passwort 
            nie auf dem Server gespeichert wird. Dies dient dem Schutz der verschlüsselten Daten.
          </li>
        </ul>
        <p style={{ marginTop: '12px', padding: '12px', backgroundColor: 'rgba(255,193,7,0.1)', borderRadius: '6px', borderLeft: '3px solid #FFC107' }}>
          <strong>Durch die Weitergabe des Familienpassworts erklären sich alle Nutzer, die Zugang 
          erhalten, mit diesen Nutzungsbedingungen einverstanden.</strong> Der Kontoersteller ist 
          dafür verantwortlich, dass alle Personen, denen das Passwort mitgeteilt wird, über 
          diese Bedingungen informiert werden.
        </p>
      </section>

      <section style={{ marginBottom: '24px' }}>
        <h3 style={{ color: 'var(--login-text-primary, #fff)', marginBottom: '12px', fontSize: '16px' }}>
          4. Kontoerstellung und Verantwortung
        </h3>
        <p>
          Der Ersteller eines Familienkontos (nachfolgend «Kontoinhaber») ist verantwortlich für:
        </p>
        <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
          <li>Die Verwaltung des Familienpassworts</li>
          <li>Die Information aller Personen, die Zugang erhalten, über diese AGB</li>
          <li>Die Einholung der Zustimmung aller Personen, deren Daten im Stammbaum erfasst werden</li>
          <li>Die sichere Aufbewahrung des Admin-Passworts</li>
        </ul>
        <p style={{ marginTop: '8px' }}>
          <strong>Mindestalter:</strong> Die Nutzung des Dienstes ist Personen ab 16 Jahren gestattet. 
          Minderjährige unter 16 Jahren dürfen den Dienst nicht nutzen.
        </p>
      </section>

      <section style={{ marginBottom: '24px' }}>
        <h3 style={{ color: 'var(--login-text-primary, #fff)', marginBottom: '12px', fontSize: '16px' }}>
          5. Datenschutz und Datenverarbeitung
        </h3>
        
        <h4 style={{ marginTop: '16px', marginBottom: '8px', fontSize: '14px', color: 'var(--login-text-secondary, #ccc)' }}>
          5.1 Verantwortlicher
        </h4>
        <p>
          Verantwortlich für die Datenverarbeitung im Sinne der Datenschutzgesetzgebung ist der 
          Betreiber (siehe Abschnitt 1).
        </p>

        <h4 style={{ marginTop: '16px', marginBottom: '8px', fontSize: '14px', color: 'var(--login-text-secondary, #ccc)' }}>
          5.2 Erhobene Daten
        </h4>
        <p>Folgende Daten werden erhoben und gespeichert:</p>
        <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
          <li>
            <strong>Bei der Registrierung:</strong> Familienname (frei wählbar), E-Mail-Adresse 
            des Administrators (serverseitig entschlüsselbar gespeichert)
          </li>
          <li>
            <strong>Im Stammbaum:</strong> Namen, Geburtsdaten, Adressen, Telefonnummern, 
            E-Mail-Adressen und weitere personenbezogene Daten der erfassten Familienmitglieder 
            (clientseitig verschlüsselt gespeichert)
          </li>
          <li>
            <strong>Bilder:</strong> Hochgeladene Fotos (unverschlüsselt gespeichert, siehe Abschnitt 5.4)
          </li>
        </ul>

        <h4 style={{ marginTop: '16px', marginBottom: '8px', fontSize: '14px', color: 'var(--login-text-secondary, #ccc)' }}>
          5.3 Verschlüsselung
        </h4>
        <p>
          Sensible personenbezogene Daten im Stammbaum werden <strong>clientseitig verschlüsselt</strong>, 
          bevor sie an den Server übertragen werden. Dies bedeutet:
        </p>
        <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
          <li>Die Daten werden mit dem Familienpasswort verschlüsselt</li>
          <li>Ohne das Passwort können die Daten nicht entschlüsselt werden</li>
          <li>Der Betreiber hat keinen Zugriff auf die verschlüsselten Daten</li>
        </ul>
        <p style={{ marginTop: '8px' }}>
          <strong>Optionale Entschlüsselung:</strong> Nutzer können in den Einstellungen die 
          Verschlüsselung deaktivieren. In diesem Fall werden die Daten im Klartext in der 
          Datenbank gespeichert und sind für den Betreiber einsehbar. Diese Option sollte nur 
          für Supportzwecke bei technischen Problemen aktiviert werden. Da sich der Dienst in 
          der Beta-Phase befindet, kann dies notwendig sein, um Fehler zu beheben.
        </p>
        <p style={{ marginTop: '8px' }}>
          <strong>Bei Passwortänderungen:</strong> Während des Prozesses der Passwortänderung 
          können Daten kurzzeitig unverschlüsselt sein. In dieser Zeit werden keine Backups 
          erstellt und die Daten werden nicht verarbeitet.
        </p>

        <h4 style={{ marginTop: '16px', marginBottom: '8px', fontSize: '14px', color: 'var(--login-text-secondary, #ccc)' }}>
          5.4 Bildspeicherung
        </h4>
        <p>
          Hochgeladene Bilder werden <strong>unverschlüsselt</strong> in einem privaten Amazon 
          S3-Bucket (Standort: Frankfurt, Deutschland) gespeichert.
        </p>
        <p style={{ marginTop: '8px' }}>
          Die Bilder sind in einem <strong>privaten S3-Bucket</strong> gespeichert und können 
          nur über authentifizierte Anfragen durch die Ancestree-Anwendung abgerufen werden. 
          Ein direkter Zugriff auf die Bilder über URLs ohne gültige Authentifizierung ist 
          nicht möglich. Die Bild-URLs selbst werden zusätzlich clientseitig verschlüsselt 
          in der Datenbank gespeichert.
        </p>
        <p style={{ marginTop: '8px', padding: '12px', backgroundColor: 'rgba(76,175,80,0.1)', borderRadius: '6px', borderLeft: '3px solid #4CAF50' }}>
          <strong>Sicherheit:</strong> Die Bilder sind durch die private Bucket-Konfiguration 
          geschützt und können nur von autorisierten Nutzern über die Anwendung abgerufen werden. 
          Selbst wenn eine Bild-URL bekannt wird, ist ein direkter Zugriff ohne gültige 
          Authentifizierung nicht möglich.
        </p>

        <h4 style={{ marginTop: '16px', marginBottom: '8px', fontSize: '14px', color: 'var(--login-text-secondary, #ccc)' }}>
          5.5 Hosting und Auftragsverarbeiter
        </h4>
        <p>Der Dienst nutzt folgende Drittanbieter:</p>
        <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
          <li>
            <strong>Amazon Web Services (AWS):</strong> 
            <ul style={{ marginTop: '4px', paddingLeft: '16px' }}>
              <li>Lightsail-Server für die Anwendung und Datenbank (Standort: Frankfurt, Deutschland)</li>
              <li>S3-Bucket für Bildspeicherung (Standort: Frankfurt, Deutschland)</li>
            </ul>
          </li>
          <li style={{ marginTop: '8px' }}>
            <strong>Photon (Komoot GmbH):</strong> Für die Geokodierung von Adressen. Bei der 
            Nutzung der Adress-Autovervollständigung werden die eingegebenen Adressdaten an 
            den Photon-Dienst (photon.komoot.io) übermittelt. Diese Anfragen erfolgen direkt 
            vom Browser des Nutzers.
          </li>
        </ul>

        <h4 style={{ marginTop: '16px', marginBottom: '8px', fontSize: '14px', color: 'var(--login-text-secondary, #ccc)' }}>
          5.6 Cookies
        </h4>
        <p>
          Der Dienst verwendet <strong>keine Cookies</strong>. Die Authentifizierung erfolgt 
          über JWT-Tokens, die im lokalen Speicher des Browsers (localStorage) abgelegt werden.
        </p>

        <h4 style={{ marginTop: '16px', marginBottom: '8px', fontSize: '14px', color: 'var(--login-text-secondary, #ccc)' }}>
          5.7 E-Mail-Kommunikation
        </h4>
        <p>
          Die bei der Registrierung angegebene E-Mail-Adresse wird für folgende Zwecke verwendet:
        </p>
        <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
          <li>Information über neue Funktionen und wichtige Änderungen während der Beta-Phase</li>
          <li>Benachrichtigung über Änderungen dieser AGB</li>
          <li>Kontaktaufnahme bei technischen Problemen</li>
        </ul>
        <p style={{ marginTop: '8px' }}>
          Während der Beta-Phase gilt diese Kommunikation als wesentlicher Bestandteil des Dienstes. 
          Ein Opt-out ist nicht möglich.
        </p>
      </section>

      <section style={{ marginBottom: '24px' }}>
        <h3 style={{ color: 'var(--login-text-primary, #fff)', marginBottom: '12px', fontSize: '16px' }}>
          6. Datenspeicherung und Löschung
        </h3>
        <p>
          <strong>Inaktive Konten:</strong> Konten, die 12 Monate nicht genutzt wurden, können 
          gelöscht werden. Vor der Löschung erfolgt eine Benachrichtigung per E-Mail.
        </p>
        <p style={{ marginTop: '8px' }}>
          <strong>Kontolöschung:</strong> Die Löschung des Kontos kann in der Anwendung 
          (Admin-Bereich) vorgenommen werden. Bei Löschung werden alle Daten entfernt, 
          einschliesslich aller Personen im Stammbaum und aller Bilder.
        </p>
        <p style={{ marginTop: '8px' }}>
          <strong>Backup-Aufbewahrung:</strong> Nach der Löschung eines Kontos werden die 
          Daten noch für maximal einen Monat in Backups aufbewahrt, bevor sie endgültig 
          gelöscht werden.
        </p>
      </section>

      <section style={{ marginBottom: '24px' }}>
        <h3 style={{ color: 'var(--login-text-primary, #fff)', marginBottom: '12px', fontSize: '16px' }}>
          7. Rechte der Nutzer
        </h3>
        <p>Nutzer haben folgende Rechte bezüglich ihrer Daten:</p>
        <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
          <li>
            <strong>Auskunft und Export:</strong> Der Datenexport kann direkt in der Anwendung 
            durchgeführt werden.
          </li>
          <li>
            <strong>Löschung:</strong> Die Kontolöschung kann direkt in der Anwendung 
            (Admin-Bereich) vorgenommen werden.
          </li>
          <li>
            <strong>Anfragen:</strong> Für sonstige Anfragen bezüglich Ihrer Daten wenden Sie 
            sich an{' '}
            <a href="mailto:m.erler@gmx.ch" style={{ color: '#4CAF50' }}>m.erler@gmx.ch</a>. 
            Die Bearbeitungszeit beträgt maximal eine Woche.
          </li>
        </ul>
      </section>

      <section style={{ marginBottom: '24px' }}>
        <h3 style={{ color: 'var(--login-text-primary, #fff)', marginBottom: '12px', fontSize: '16px' }}>
          8. Kosten
        </h3>
        <p>
          Der Dienst ist derzeit kostenlos nutzbar. In Zukunft kann eine Kostenpflicht für 
          neue Konten eingeführt werden. Bestehende Konten, die vor Einführung der 
          Kostenpflicht erstellt wurden, bleiben von dieser unberührt.
        </p>
      </section>

      <section style={{ marginBottom: '24px' }}>
        <h3 style={{ color: 'var(--login-text-primary, #fff)', marginBottom: '12px', fontSize: '16px' }}>
          9. Änderungen der AGB
        </h3>
        <p>
          Der Betreiber behält sich vor, diese AGB jederzeit zu ändern. Bei Änderungen werden 
          registrierte Nutzer per E-Mail benachrichtigt.
        </p>
        <p style={{ marginTop: '8px' }}>
          Nutzer haben nach Benachrichtigung über Änderungen die Möglichkeit, den neuen 
          Bedingungen zuzustimmen. Erfolgt innerhalb eines Monats keine Zustimmung zu den 
          neuen Bedingungen, kann das Konto gelöscht werden.
        </p>
      </section>

      <section style={{ marginBottom: '24px' }}>
        <h3 style={{ color: 'var(--login-text-primary, #fff)', marginBottom: '12px', fontSize: '16px' }}>
          10. Haftungsbeschränkung
        </h3>
        <p>
          Im gesetzlich zulässigen Rahmen schliesst der Betreiber jegliche Haftung für 
          Schäden aus, die durch die Nutzung des Dienstes entstehen. Dies umfasst insbesondere:
        </p>
        <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
          <li>Datenverluste</li>
          <li>Ausfallzeiten des Dienstes</li>
          <li>Unbefugten Zugriff auf Daten durch Dritte</li>
          <li>Fehler in der Software</li>
        </ul>
        <p style={{ marginTop: '8px' }}>
          Die Nutzung des Dienstes erfolgt auf eigenes Risiko.
        </p>
      </section>

      <section style={{ marginBottom: '24px' }}>
        <h3 style={{ color: 'var(--login-text-primary, #fff)', marginBottom: '12px', fontSize: '16px' }}>
          11. Sprache
        </h3>
        <p>
          Diese AGB sind in deutscher Sprache verfasst. Es liegt in der Verantwortung des 
          Nutzers, die Bedingungen zu verstehen. Bei Unklarheiten wenden Sie sich bitte an 
          den Betreiber.
        </p>
      </section>

      <section style={{ marginBottom: '24px' }}>
        <h3 style={{ color: 'var(--login-text-primary, #fff)', marginBottom: '12px', fontSize: '16px' }}>
          12. Salvatorische Klausel
        </h3>
        <p>
          Sollten einzelne Bestimmungen dieser AGB unwirksam sein oder werden, bleibt die 
          Wirksamkeit der übrigen Bestimmungen unberührt.
        </p>
      </section>

      <section style={{ marginBottom: '16px', paddingTop: '16px', borderTop: '1px solid var(--login-border, #333)' }}>
        <p style={{ fontSize: '12px', color: 'var(--login-text-secondary, #888)' }}>
          Version: {TERMS_VERSION}<br />
          Letzte Aktualisierung: {TERMS_LAST_UPDATED}
        </p>
      </section>
    </div>
  );
}
