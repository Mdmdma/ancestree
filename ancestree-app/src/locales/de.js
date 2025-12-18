// German (Deutsch) translations - Default language
export const de = {
  // Language metadata
  _meta: {
    code: 'de',
    name: 'Deutsch',
    flag: '🇩🇪'
  },

  // Header text configuration
  header: {
    title: "Familienstammbaum",
    familyPrefix: "Familie",
    subtitle: "Verbindungen über Generationen",
    description: "Hilf jetzt mit unseren Stammbaum zu vervollständigen",
    logoutButton: "Logout"
  },
  
  // UI text configuration
  ui: {
    // Loading states
    loading: {
      familyTree: "Lade Stammbaum ..."
    },

    // Collaboration
    collaboration: {
      usersCollaborating: "🤝 {count} online",
      userOnline: "👤 {count} Familienmitglieder online"
    },

    // Tab labels
    tabs: {
      editor: "👤 Editor",
      photos: "📸 Fotos",
      map: "🗺️ Karte"
    },

    // Editor section text
    editor: {
      selectPersonTitle: "Wähle eine Person",
      selectPersonDescription: "Klicke auf eine beliebige Person, um ihre Informationen zu bearbeiten.",
      addPersonDescription: "Ziehe von einem farbigen Punkt ins leere, um eine neue Person hinzuzufügen.",
      
      // Button labels
      buttons: {
        autoLayout: "🔄 Auto Layout",
        fitToView: "🔍 Fit to View",
      },

      // Keyboard shortcuts help text
      shortcutsHelp: {
        autoLayout: "Auto Layout: Strg+L (Cmd+L)",
        fitToView: "Fit to View: Strg+F (Cmd+F)",
        debugMode: "Debug Mode: Strg+Shift+D (Cmd+Shift+D)"
      },

      // Connection rules
      connectionRules: {
        title: "Verbindungsregeln:",
        parent: "🔴 Rot (oben): Eltern hinzufügen",
        child: "🟠 Orange (unten): Kinder hinzufügen",
        partner: "🔵 Blau (links/rechts): Partner hinzufügen"
      },

      // Validation messages
      validationMessages: {
        familyToFamily: "Direkte Verbindungen zwischen Familien-Knoten sind nicht erlaubt. Verbinde stattdessen Personen mit Familien.",
        directParentChild: "Direkte Eltern-Kind-Verbindungen zwischen Personen sind nicht erlaubt. Verwende Familien-Knoten, um Generationen zu repräsentieren.",
        partnerNodePartnerHandle: "{name} ist ein Partner-Knoten und kann keine weiteren Partner-Verbindungen eingehen. Nur Blutlinien-Knoten können mehrere Partner haben.",
        partnerNodeMultiplePartners: "{name} ist bereits mit einem Blutlinien-Partner verbunden. Partner-Knoten können nur einen Partner haben.",
        bloodlineToBloodlinePartner: "Damit das automatische Layout funktioniert, könne Blutlinien Knoten nicht miteinander verbunden werden. Sollte dies erforderlich sein, füge die Entsprechende Person erneut als Partner hinzu",
        partnerNodeParentHandle: "{name} ist ein Partner-Knoten und kann den Eltern-Anschluss nicht verwenden. Partner-Knoten können nur über Kind-Anschlüsse Familien bilden.",
        bloodlineMultipleParents: "{name} hat bereits {count} Eltern-Verbindung(en). Blutlinien-Knoten können nur eine Eltern-Familie haben."
      },

      // Debug information
      debug: {
        title: "🔧 ELK Debug Information",
        overview: "Übersicht:",
        totalNodes: "Gesamt Knoten:",
        bloodlineNodes: "Blutlinien-Knoten (in ELK):",
        partnerOnlyNodes: "Nur-Partner-Knoten:",
        bloodlineEdges: "Blutlinien-Kanten (für Layout):",
        fakeEdges: "Falsche Blutlinien-Kanten (ignoriert):",
        partnerEdges: "Partner-Kanten:",
        partnerCounts: "Partner-Anzahl:",
        partners: "Partner",
        partnersPlural: "Partner",
        elkNodeDimensions: "ELK Knoten-Dimensionen:",
        nodeLabel: "Knoten",
        width: "Breite:",
        height: "Höhe:",
        partnersLabel: "Partner:",
        birth: "Geburt:",
        notSet: "Nicht gesetzt"
      }
    },
    
    // Image tagging mode
    imageTagging: {
      activeMessage: "🏷️ Bild-Markierungsmodus aktiv - Klicke auf eine Person, um sie automatisch zu markieren"
    },
    
    // Image Gallery component
    imageGallery: {
      title: "📸 Familienfotos",
      
      // Gallery view
      gallery: {
        uploadButton: "📤 Bilder hochladen",
        refreshButton: "🔄 Aktualisieren",
        noImagesTitle: "Noch keine Bilder hochgeladen.",
        noImagesDescription: "Klicke auf \"Bilder hochladen\", um dein erstes Familienfoto hinzuzufügen!",
        noDescription: "Keine Beschreibung",
        personTagged: "Person markiert",
        personsTagged: "Personen markiert"
      },
      
      // Upload view
      upload: {
        backButton: "← Zurück zur Galerie",
        dragDropTitle: "Per Drag & Drop oder Klick hochladen",
        supportedFormats: "Unterstützte Formate: JPEG, PNG, GIF, WebP (Max 25MB pro Bild, max. 15 Bilder)",
        selectFileButton: "📁 Dateien auswählen",
        dropHereMessage: "",
        howItWorksTitle: "📝 So funktioniert's:",
        steps: [
          "Wähle ein oder mehrere Bilder aus oder ziehe sie herein (max. 15)",
          "Füge eine Beschreibung hinzu (optional, gilt für alle Bilder)",
          "Bestätige und lade hoch",
          "Markiere Familienmitglieder in den Fotos"
        ]
      },
      
      // Confirm view
      confirm: {
        backButton: "← Zurück",
        cancelButton: "✖ Abbrechen",
        title: "📋 Upload bestätigen",
        titleMultiple: "📋 {count} Bilder hochladen",
        previewAlt: "Vorschau",
        fileInfoTitle: "Datei-Informationen",
        filenameLabel: "Dateiname:",
        sizeLabel: "Größe:",
        typeLabel: "Typ:",
        imageCountLabel: "Bilder:",
        totalSizeLabel: "Gesamtgröße:",
        descriptionLabel: "Beschreibung (optional):",
        descriptionLabelMultiple: "Beschreibung für alle Bilder (optional):",
        descriptionPlaceholder: "Gib eine Beschreibung für dieses Bild ein...",
        descriptionHint: "Füge Details hinzu, wann und wo dieses Foto aufgenommen wurde, wer darauf zu sehen ist oder andere relevante Informationen.",
        descriptionHintMultiple: "Diese Beschreibung wird für alle ausgewählten Bilder verwendet. Du kannst die Beschreibungen später einzeln anpassen.",
        uploadButton: "Bild hochladen",
        uploadButtonMultiple: "{count} Bilder hochladen",
        uploadingButton: "⏳ Wird hochgeladen...",
        uploadingMessage: "Bitte warte, während dein Bild hochgeladen wird...",
        uploadingMessageMultiple: "Bitte warte, während deine Bilder hochgeladen werden...",
        processingUpload: "Upload wird verarbeitet...",
        removeImage: "Entfernen",
        addMoreImages: "+ Weitere Bilder hinzufügen",
        retryFailed: "Fehlgeschlagene erneut versuchen",
        retryUpload: "Erneut versuchen"
      },
      
      // View image
      view: {
        backButton: "← Zurück zur Galerie",
        tagPeopleButton: "🏷 Personen markieren",
        cancelTaggingButton: "✖ Markierung abbrechen",
        deleteButton: "🗑 Bild löschen",
        descriptionTitle: "Beschreibung",
        taggedPeopleTitle: "Markierte Personen",
        noTaggedPeople: "Noch keine Personen in diesem Bild markiert.",
        tagPeoplePrompt: "Klicke auf \"Personen markieren\", um Familienmitglieder zu markieren!",
        removeButton: "Entfernen",
        loadingImage: "Bild wird geladen..."
      },
      
      // Error messages
      errors: {
        invalidFileType: "Bitte wähle eine gültige Bilddatei (JPEG, PNG, GIF oder WebP)",
        fileSizeExceeded: "Die Dateigröße muss weniger als 25MB betragen",
        uploadFailed: "Fehler beim Hochladen des Bildes: ",
        deleteFailed: "Fehler beim Löschen des Bildes: ",
        tagFailed: "Fehler beim Markieren der Person: ",
        removeFailed: "Fehler beim Entfernen der Person: ",
        loadFailed: "Fehler beim Laden der Bilder:",
        unknownError: "Unbekannter Fehler",
        batchSizeExceeded: "Maximal {max} Bilder können gleichzeitig hochgeladen werden.",
        someFilesSkipped: "Einige Dateien wurden übersprungen:",
        someUploadsFailed: "Einige Uploads sind fehlgeschlagen:",
        allUploadsFailed: "Alle Uploads sind fehlgeschlagen. Bitte versuche es erneut."
      },
      
      // Success messages
      success: {
        uploadSuccess: "Bild erfolgreich hochgeladen!",
        batchUploadSuccess: "{count} Bilder erfolgreich hochgeladen!",
        partialUpload: "{success} von {total} Bildern erfolgreich hochgeladen. {failed} fehlgeschlagen.",
        deleteSuccess: "Bild erfolgreich gelöscht!",
        personRemoved: "Person vom Bild entfernt!"
      },
      
      // Confirmation dialogs
      confirmations: {
        deleteImage: "Bist du sicher, dass du dieses Bild löschen möchtest? Diese Aktion kann nicht rückgängig gemacht werden."
      }
    },
    
    // Person Picture Slideshow component
    slideshow: {
      loadingTitle: "Bilder werden geladen...",
      loadingMessage: "Bilder werden geladen...",
      errorTitle: "Fehler",
      errorMessage: "Fehler beim Laden der Bilder: ",
      noPicturesIcon: "📷",
      noPicturesMessage: "Keine Bilder gefunden für ",
      picturesTitle: "Bilder von ",
      descriptionTitle: "Beschreibung",
      taggedPeopleTitle: "Markierte Personen",
      taggedMessage: "Diese Person ist in diesem Bild markiert",
      editButton: "✏️ Bearbeiten",
      saveButton: "💾 Speichern",
      cancelButton: "✖ Abbrechen",
      descriptionPlaceholder: "Beschreibung eingeben...",
      noDescription: "Keine Beschreibung vorhanden",
      fullscreenButton: "⛶ Vollbild",
      exitFullscreenButton: "⛶ Vollbild verlassen",
      previousButton: "‹",
      nextButton: "›",
      questionButton: "? Markiere Bilder mit offenen Fragen  ?"
    },
    
    // Node Editor configuration
    nodeEditor: {
      title: 'Daten ergänzen',
      missingTaggedImage: 'Diese Person muss in mindestens einem Bild markiert werden',
      labels: {
        name: 'Name:',
        surname: 'Nachname:',
        maidenName: 'Geburtsname:',
        birthDate: 'Geburtsdatum:',
        deathDate: 'Todestag:',
        phone: 'Telefon:',
        email: 'E-Mail:',
        street: 'Straße:',
        housenumber: 'Nr:',
        city: 'Stadt:',
        zip: 'PLZ:',
        country: 'Land:',
        addressAutocomplete: 'Adresssuche'
      },
      placeholders: {
        phone: 'z.B. +43 5287 87123',
        email: 'z.B. name@beispiel.com',
        maidenName: 'z.B. Müller (falls abweichend)',
        street: 'z.B. Hauptstraße',
        housenumber: 'z.B. 42',
        city: 'z.B. Innsbruck',
        zip: '6020',
        country: 'z.B. AT, DE, CH',
        addressAutocomplete: 'Ganze Adresse eingeben: Straße, Stadt, Land...'
      },
      validation: {
        phoneFormat: 'Telefonnummer muss mit + beginnen und nur Zahlen enthalten',
        emailFormat: 'Bitte gib eine gültige E-Mail-Adresse ein'
      },
      debug: {
        title: '🔧 Debug Felder',
        nodeId: 'Node ID (Read-only):',
        bloodlineStatus: 'Bloodline Status:',
        bloodlineOnStatus: 'Auf der Blutlinie',
        bloodlineOffStatus: 'Nur Partner',
        xPosition: 'X Position:',
        yPosition: 'Y Position:',
        connections: 'Verbindungen',
        totalConnections: 'Gesamt Verbindungen:'
      },
      buttons: {
        pictures: '📷 Bilder',
        delete: '🗑️ Person löschen',
        deleteFamily: '🗑️ Familie löschen'
      },
      messages: {
        deleteWithConnections: 'Diese Person kann nicht gelöscht werden, da sie noch Verbindungen zu anderen Personen hat. Entferne zuerst alle Verbindungen.',
        confirmDelete: 'wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.',
        confirmDeletePrefix: 'Möchtest du "',
        confirmDeleteSuffix: '" '
      }
    },
    
    // Common UI elements
    common: {
      loading: "Wird geladen...",
      error: "Fehler",
      cancel: "Abbrechen",
      confirm: "Bestätigen",
      save: "Speichern",
      delete: "Löschen",
      edit: "Bearbeiten",
      back: "Zurück",
      next: "Weiter",
      previous: "Zurück",
      close: "Schließen"
    },

    // Contact information
    contact: {
      buttonText: "📧 Kontakt",
      dialogTitle: "Kontaktiere den Entwickler",
      description: "Hallo! Ich bin Mathis, der Entwickler von AncesTree. Falls du Fragen, Anregungen oder technische Probleme hast, kannst du mich gerne kontaktieren. Ich helfe dir gerne weiter!",
      emailButtonText: "📧 E-Mail senden",
      emailAddress: "m.erler@gmx.ch",
      githubButtonText: "💻 GitHub",
      githubUrl: "https://github.com/Mdmdma/ancestree",
      closeButton: "Schließen"
    },

    // Admin Panel texts (German for UI elements)
    adminPanel: {
      title: "Admin Panel",
      authPrompt: "Gib das Admin-Passwort ein, um auf die Einstellungen zuzugreifen.",
      defaultAdminNote: "Standard-Passwort: adminn",
      contactAdmin: {
        message: "Kontaktiere den Ersteller deines Familienstammbaums:",
        noEmailSet: "Keine E-Mail-Adresse hinterlegt"
      },
      contactFamily: {
        message: "Kontaktiere alle Familienmitglieder im Stammbaum:",
        button: "Die ganze Familie kontaktieren",
        subject: "Auskünfte zum Stammbaum",
        noEmailsFound: "Keine E-Mail-Adressen im Stammbaum gefunden"
      },
      menu: {
        familyParameters: "Famillienparameter",
        passwords: "Passwörter",
        security: "Sicherheit",
        visibleFields: "Sichtbare Felder",
        completion: "Vervollständigung",
        dataExport: "Daten exportieren",
        dangerZone: "⚠️ Gefahrenzone"
      },
      familyParameters: {
        title: "Familienparameter",
        displayNameLabel: "Anzeigename",
        adminEmailLabel: "Admin E-Mail",
        adminEmailHint: "Wird für Kontoanfragen und wichtige Benachrichtigungen verwendet",
        purposeLabel: "Wieso das Ganze",
        purposePlaceholder: "Beschreibe den Zweck dieses Familienstammbaums...",
        saveButton: "Speichern"
      },
      passwords: {
        title: "Passwörter",
        familyPasswordLabel: "Familienpasswort",
        adminPasswordLabel: "Admin-Passwort",
        newPasswordLabel: "Neues Passwort",
        confirmPasswordLabel: "Passwort bestätigen",
        currentFamilyPasswordPlaceholder: "Aktuelles Familienpasswort",
        newFamilyPasswordPlaceholder: "Neues Familienpasswort",
        confirmFamilyPasswordPlaceholder: "Familienpasswort bestätigen",
        newAdminPasswordPlaceholder: "Neues Admin-Passwort",
        confirmAdminPasswordPlaceholder: "Admin-Passwort bestätigen",
        saveButton: "Passwort aktualisieren"
      },
      security: {
        title: "Sicherheit",
        encryptionLabel: "Client-seitige Verschlüsselung aktivieren",
        encryptionHint: "Wenn aktiviert, werden alle gespeicherten Daten client-seitig mit dem Familienpasswort verschlüsselt.",
        nodeCreationLockLabel: "Knotenerstellung sperren",
        nodeCreationLockHint: "Wenn aktiviert, können Benutzer keine neuen Knoten im Stammbaum erstellen"
      },
      visibleFields: {
        title: "Sichtbare Felder",
        description: "Steuere, welche Felder im Dateneditor angezeigt werden.",
        streetFieldsLabel: "Straße und Hausnummer anzeigen",
        streetFieldsHint: "Wenn aktiviert, werden die Felder für Straße und Hausnummer im Editor angezeigt.",
        phoneFieldLabel: "Telefonnummer anzeigen",
        phoneFieldHint: "Wenn aktiviert, wird das Feld für Telefonnummer im Editor angezeigt.",
        emailFieldLabel: "E-Mail-Adresse anzeigen",
        emailFieldHint: "Wenn aktiviert, wird das Feld für E-Mail-Adresse im Editor angezeigt.",
        showSuccess: "Straßenfelder werden nun angezeigt",
        hideSuccess: "Straßenfelder sind nun ausgeblendet",
        phoneShowSuccess: "Telefonnummer-Feld wird nun angezeigt",
        phoneHideSuccess: "Telefonnummer-Feld ist nun ausgeblendet",
        emailShowSuccess: "E-Mail-Feld wird nun angezeigt",
        emailHideSuccess: "E-Mail-Feld ist nun ausgeblendet",
        updateError: "Fehler beim Aktualisieren der Feldersichtbarkeit"
      },
      completion: {
        title: "✅ Vervollständigung verfolgen",
        description: "Verfolge, welche Personenknoten unvollständige Pflichtfelder haben. Wenn aktiviert, werden Knoten mit fehlenden erforderlichen Informationen mit einem roten Rand hervorgehoben und vollständige Knoten mit einem grünen Rand.",
        mainToggleLabel: "Unvollständige Knoten anzeigen",
        mainToggleHint: "Wenn aktiviert, zeigen Personenknoten mit fehlenden Pflichtfeldern einen roten Rand und vollständige Knoten einen grünen Rand",
        requiredFieldsTitle: "Pflichtfelder",
        requiredFieldsDescription: "Wähle aus, welche Felder für einen Knoten als vollständig erforderlich sind. Unvollständige Pflichtfelder werden im Knoteneditor rot hervorgehoben.",
        fields: {
          name: {
            label: "Name",
            hint: "Vorname ist erforderlich"
          },
          surname: {
            label: "Nachname",
            hint: "Familienname ist erforderlich"
          },
          maidenName: {
            label: "Geburtsname",
            hint: "Geburtsname ist erforderlich (falls zutreffend)"
          },
          birthDate: {
            label: "Geburtsdatum",
            hint: "Geburtsdatum ist erforderlich"
          },
          streetFields: {
            label: "Straße & Hausnummer",
            hint: "Straßenadresse ist erforderlich"
          },
          cityZip: {
            label: "Stadt & Postleitzahl",
            hint: "Stadt und Postleitzahl sind erforderlich"
          },
          country: {
            label: "Land",
            hint: "Land ist erforderlich"
          },
          phone: {
            label: "Telefon",
            hint: "Telefonnummer ist erforderlich"
          },
          email: {
            label: "E-Mail",
            hint: "E-Mail-Adresse ist erforderlich"
          },
          taggedImage: {
            label: "📷 Markiertes Bild",
            hint: "Person muss in mindestens einem Bild markiert sein"
          }
        },
        success: "Vervollständigungseinstellungen aktualisiert",
        updateError: "Fehler beim Aktualisieren der Einstellung",
        settingsUpdateError: "Fehler beim Aktualisieren der Vervollständigungseinstellungen"
      },
      errors: {
        passwordsDoNotMatch: "Passwörter stimmen nicht überein",
        passwordTooShort: "Passwort muss mindestens 6 Zeichen lang sein",
        currentPasswordRequired: "Aktuelles Familienpasswort ist erforderlich, um Daten neu zu verschlüsseln",
        testFailed: "Test fehlgeschlagen: "
      },
      success: {
        familyPasswordUpdated: "Familienpasswort erfolgreich aktualisiert!",
        adminPasswordUpdated: "Admin-Passwort erfolgreich aktualisiert!",
        settingsUpdated: "Einstellungen erfolgreich aktualisiert!",
        encryptionEnabled: "Verschlüsselung erfolgreich aktiviert!",
        encryptionDisabled: "Verschlüsselung erfolgreich deaktiviert!"
      },
      encryption: {
        confirmEnable: "Möchtest du die Verschlüsselung wirklich aktivieren? Dies wird alle Daten neu verschlüsseln.",
        confirmDisable: "Möchtest du die Verschlüsselung wirklich deaktivieren? Dies wird alle Daten entschlüsseln.",
        enterPassword: "Familienpasswort eingeben:",
        enterPasswordPlaceholder: "Familienpasswort eingeben",
        confirmButton: "Bestätigen",
        cancelButton: "Abbrechen",
        progress: {
          encrypting: "Verschlüssele Daten...",
          decrypting: "Entschlüssele Daten...",
          complete: "Abgeschlossen!"
        }
      },
      dataExport: {
        title: "Daten exportieren",
        description: "Lade alle Familiendaten und Bilder als ZIP-Datei herunter.",
        downloadButton: "📥 Daten herunterladen",
        downloadingButton: "⏳ Wird heruntergeladen...",
        progress: {
          loadingNodes: "Lade Personendaten...",
          loadingImages: "Lade Bildmetadaten...",
          generatingCSV: "Erstelle CSV-Datei...",
          downloadingImages: "Lade Bilder herunter ({current}/{total})...",
          creatingZip: "Erstelle ZIP-Archiv...",
          complete: "Download abgeschlossen!"
        },
        whatWillBeExported: "Was wird exportiert:",
        exportItems: {
          personalData: "Alle Personendaten (entschlüsselt) als CSV",
          images: "Alle Familienbilder",
          imageMetadata: "Bildmetadaten (Beschreibungen und markierte Personen) als Textdateien"
        },
        hints: {
          decrypted: "💡 Hinweis: Alle exportierten Daten sind entschlüsselt und lesbar.",
          keepSafe: "🔒 Bewahre die heruntergeladene Datei sicher auf."
        },
        errors: {
          noNodes: "Keine Personendaten zum Exportieren gefunden.",
          downloadFailed: "Fehler beim Herunterladen der Daten: "
        }
      },
      dangerZone: {
        title: "⚠️ Gefahrenzone",
        description: "Die Aktionen in diesem Bereich sind unwiderruflich und löschen dauerhaft alle Familiendaten.",
        deleteDatabase: {
          title: "Familiendatenbank löschen",
          description: "Dies wird dauerhaft löschen:",
          items: {
            treeData: "Alle Stammbaumdaten (Personen, Beziehungen)",
            images: "Alle Bilder und Medien",
            locations: "Alle Standortdaten",
            databaseFile: "Die Familiendatenbankdatei",
            authEntry: "Deinen Familien-Account aus der Authentifizierungsdatenbank"
          },
          deleteButton: "Familiendatenbank löschen",
          finalWarning: {
            title: "⚠️ LETZTE WARNUNG",
            message: "Diese Aktion kann nicht rückgängig gemacht werden. Alle Daten gehen dauerhaft verloren."
          },
          confirmLabel: "Tippe <strong>LÖSCHEN</strong> zur Bestätigung:",
          confirmPlaceholder: "LÖSCHEN",
          adminPasswordLabel: "Admin-Passwort eingeben:",
          adminPasswordPlaceholder: "Admin-Passwort",
          deleteButtonFinal: "🗑️ Dauerhaft löschen",
          deleting: "Wird gelöscht...",
          cancelButton: "Abbrechen"
        }
      }
    },

    // Admin panel small labels and actions
    adminPanelCommon: {
      authenticateButton: 'Authentifizieren',
      authenticating: 'Wird authentifiziert...',
      updateButton: 'Aktualisieren',
      saveButton: 'Speichern',
      cancelButton: 'Abbrechen',
      closeButton: '×',
      currentFamilyPasswordLabel: 'Aktuelles Familienpasswort (erforderlich für Neuverschlüsselung):',
      noDescription: 'Keine Beschreibung festgelegt.'
    },

    // Login component
    login: {
      welcome: {
        titleRegister: 'Richte deinen Familienstammbaum ein',
        titleLogin: 'Willkommen bei AncesTree',
        setupDescription: 'Erstelle sichere Zugangsdaten für deine Familie',
        registerDescription: 'Richte einen neuen Familienstammbaum ein',
        loginDescription: 'Melde dich an, um auf deinen Familienstammbaum zuzugreifen'
      },
      form: {
        familyNameLabel: 'Familienname:',
        familyIdLabel: 'Eindeutiger Familienbezeichner:',
        familyNamePlaceholder: 'Gib deinen Familiennamen ein',
        familyIdPlaceholder: 'z.B. mueller-familie-2024',
        familyIdHint: 'Wird für Login verwendet (kann später nicht geändert werden)',
        displayNameLabel: 'Anzeigename:',
        displayNamePlaceholder: 'z.B. Die Familie Müller',
        displayNameHint: 'Wird in der App angezeigt (kann später geändert werden)',
        adminEmailLabel: 'Admin E-Mail:',
        adminEmailPlaceholder: 'admin@beispiel.de',
        adminEmailHint: 'Wird für Kontoanfragen und wichtige Benachrichtigungen verwendet',
        betaAccessPasswordLabel: 'Beta-Zugangscode:',
        betaAccessPasswordPlaceholder: 'Gib den Beta-Zugangscode ein',
        betaAccessPasswordHint: 'Kontaktiere mich, um den Beta-Zugangscode zu erhalten',
        passwordLabel: 'Passwort:',
        createPasswordLabel: 'Passwort erstellen:',
        passwordPlaceholder: 'Gib dein Passwort ein',
        createPasswordPlaceholder: 'Erstelle ein sicheres Passwort',
        adminPasswordLabel: 'Admin-Passwort:',
        adminPasswordPlaceholder: 'Erstelle Admin-Passwort (mind. 6 Zeichen)',
        adminPasswordHint: 'Erforderlich für Zugriff auf Admin-Panel und Einstellungen'
      },
      buttons: {
        register: 'Familienzugang erstellen',
        login: 'Auf Familienstammbaum zugreifen',
        pleaseWait: 'Bitte warten...',
        switchToLogin: 'Bereits Zugang? Anmelden',
        switchToRegister: 'Erstes Mal? Familienzugang einrichten'
      },
      security: {
        privateNotice: '🔒 Dein Familienstammbaum ist privat und sicher',
        authorizedOnly: 'Nur autorisierte Familienmitglieder haben Zugriff'
      },
      terms: {
        checkboxText: 'Ich akzeptiere die',
        termsLink: 'Nutzungsbedingungen und Datenschutzerklärung',
        ageConfirmation: 'und bestätige, dass ich mindestens 16 Jahre alt bin.',
        loginNotice: 'Mit der Anmeldung akzeptieren Sie die',
        termsRequired: 'Sie müssen die Nutzungsbedingungen akzeptieren'
      },
      validation: {
        invalidEmail: 'Bitte gib eine gültige E-Mail-Adresse ein',
        emailRequired: 'Admin E-Mail ist erforderlich'
      }
    },

    // Map View component
    mapView: {
      title: "🗺️ Wer wohnt wo",
      refreshButton: "",
      loadingLocations: "🔄 Standorte werden geladen...",
      unknownName: "Unbekannt",
      selectedPersonAddress: "📍",
      noAddressAvailable: "Keine Adresse verfügbar",
      noLocationsTitle: "Keine Standorte gefunden",
      noLocationsMessage: "Füge Stadt- und Länderinformationen zu Personen im Editor hinzu, um sie auf der Karte zu sehen.",
      mapIcon: "🗺️",
      fullscreenEnter: "Vollbild aktivieren",
      fullscreenExit: "Vollbild beenden",
      errors: {
        failedToLoad: "Fehler beim Laden der Standorte"
      },
      noLocations: "Keine Standorte gefunden"
    },

    // Default node names for auto-generated nodes
    defaultNames: {
      partner: "Partner",
      child: "Kind", 
      parent: "Eltern",
      family: "Familie"
    },

    // Node Search component
    nodeSearch: {
      placeholder: "Personen suchen...",
      navigatingPlaceholder: "Navigiere zu Person...",
      searchingMessage: "Suche läuft...",
      noResultsMessage: "Keine Personen gefunden für \"{searchTerm}\"",
      resultCountSingle: "{count} Person gefunden",
      resultCountMultiple: "{count} Personen gefunden",
      resultCountLimited: "Zeige 8 von {total} gefundenen Personen",
      unnamedPerson: "Unbenannte Person",
      bornLabel: "Geboren:"
    },

    // Family Gallery Slideshow component
    familyGallery: {
      title: "‍‍Fotoalbum",
      loadingTitle: "Lade Familienbilder...",
      loadingMessage: "Familienbilder werden geladen...",
      errorTitle: "Fehler",
      errorMessage: "Fehler beim Laden der Familienbilder: ",
      noPicturesIcon: "📷",
      noPicturesTitle: "Keine Familienbilder gefunden",
      noPicturesMessage: "Es wurden noch keine Bilder zur Familiengalerie hinzugefügt.",
      descriptionTitle: "Beschreibung",
      taggedPeopleTitle: "Markierte Personen",
      noTaggedPeople: "Keine Personen in diesem Bild markiert.",
      editButton: "✏️ Bearbeiten",
      saveButton: "💾 Speichern",
      cancelButton: "✖ Abbrechen",
      descriptionPlaceholder: "Beschreibung eingeben...",
      noDescription: "Keine Beschreibung vorhanden",
      galleryButton: "🖼️ Familien-Album",
      fullscreenButton: "⛶ Vollbild",
      exitFullscreenButton: "⛶ Vollbild verlassen",
      previousButton: "‹",
      nextButton: "›",
      questionButton: "? Markiere Bilder mit offenen Fragen  ?"
    },

    // Alerts and notifications
    alerts: {
      nodeCreationLocked: {
        title: "⚠️ Knotenerstellung gesperrt",
        message: "Die Knotenerstellung ist derzeit vom Administrator deaktiviert. Bitte kontaktiere den Administrator, um die Knotenerstellung freizuschalten."
      },
      lastBloodlineNodeDelete: {
        title: "⚠️ Löschen nicht möglich",
        message: "Die letzte Blutlinie-Person kann nicht gelöscht werden. Es muss mindestens eine Person in der Blutlinie vorhanden sein."
      }
    },

    // Chat component for image discussions
    chat: {
      title: "💬 Diskussion",
      noMessages: "Noch keine Nachrichten. Starte die Diskussion über dieses Bild!",
      namePlaceholder: "Dein Name...",
      messagePlaceholder: "Schreibe einen Kommentar zu diesem Bild... (Strg+Enter zum Senden)",
      sendButton: "Senden",
      sendingButton: "Wird gesendet...",
      deleteButton: "Löschen",
      nameRequired: "Bitte gib deinen Namen ein",
      messageRequired: "Bitte schreibe eine Nachricht",
      messageTooLong: "Die Nachricht darf maximal 300 Zeichen enthalten",
      loadingMessages: "Lade Nachrichten...",
      errorLoading: "Fehler beim Laden der Nachrichten",
      errorSending: "Fehler beim Senden der Nachricht",
      errorDeleting: "Fehler beim Löschen der Nachricht",
      deleteConfirm: "Möchtest du diese Nachricht wirklich löschen?",
      timeFormat: {
        justNow: "gerade eben",
        minutesAgo: "vor {minutes} Min.",
        hoursAgo: "vor {hours} Std.", 
        daysAgo: "vor {days} Tagen",
        dateFormat: "DD.MM.YYYY HH:mm"
      }
    },

    // Language picker
    languagePicker: {
      label: "Sprache",
      selectLanguage: "Sprache auswählen"
    },

    // Terms Acceptance Dialog
    termsAcceptance: {
      title: "Neue Nutzungsbedingungen",
      updateRequired: "Aktualisierung erforderlich",
      updateRequiredMessage: "Es gibt aktualisierte Nutzungsbedingungen und Datenschutzbestimmungen (Version {version}), die Sie akzeptieren müssen, um den Dienst weiterhin nutzen zu können.",
      currentAcceptedVersion: "Ihre aktuell akzeptierte Version: {version}",
      accountOwnerNotice: "Als Kontoinhaber sind Sie dafür verantwortlich, alle Personen, die Zugang zu Ihrem Familienkonto haben, über die aktualisierten Bedingungen zu informieren.",
      readFullTerms: "Vollständige Nutzungsbedingungen und Datenschutzerklärung lesen",
      versionInfo: "Version {version} | Stand: {date}",
      adminPasswordLabel: "Admin-Passwort zur Bestätigung",
      adminPasswordPlaceholder: "Admin-Passwort eingeben",
      adminPasswordHint: "Das Admin-Passwort wird benötigt, um die neuen Bedingungen im Namen aller Familienmitglieder zu akzeptieren.",
      deadlineWarning: "Wenn Sie die neuen Bedingungen nicht innerhalb eines Monats nach deren Veröffentlichung akzeptieren, wird Ihr Konto und alle zugehörigen Daten gelöscht.",
      laterButton: "Später",
      acceptButton: "Nutzungsbedingungen akzeptieren",
      acceptingButton: "Wird akzeptiert...",
      errors: {
        adminPasswordRequired: "Bitte geben Sie das Admin-Passwort ein",
        acceptFailed: "Fehler beim Akzeptieren der Nutzungsbedingungen"
      }
    },

    // Terms and Conditions modal
    termsAndConditions: {
      title: "Nutzungsbedingungen und Datenschutzerklärung",
      closeButton: "Schliessen"
    }
  }
};

export default de;
