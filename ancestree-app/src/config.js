// Application configuration
export const appConfig = {
  // Header text configuration
  header: {
    title: "Familie Inntertal",
    subtitle: "Verbindungen über Generationen",
    description: "Hilf jetzt mit unseren Stammbaum zu vervollständigen"
  },
  
  // UI text configuration
  ui: {
    // Loading states
    loading: {
      familyTree: "Lade Stammbaum ..."
    },

    // Collaboration
    collaboration: {
      usersCollaborating: "🤝 {count} Familienmitglieder arbeiten zusammen",
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
        uploadButton: "📤 Bild hochladen",
        refreshButton: "🔄 Aktualisieren",
        noImagesTitle: "Noch keine Bilder hochgeladen.",
        noImagesDescription: "Klicke auf \"Bild hochladen\", um dein erstes Familienfoto hinzuzufügen!",
        noDescription: "Keine Beschreibung",
        personTagged: "Person markiert",
        personsTagged: "Personen markiert"
      },
      
      // Upload view
      upload: {
        backButton: "← Zurück zur Galerie",
        dragDropTitle: "Per Drag & Drop oder Klick hochladen",
        supportedFormats: "Unterstützte Formate: JPEG, PNG, GIF, WebP (Max 10MB)",
        selectFileButton: "📁 Datei auswählen",
        dropHereMessage: "",
        howItWorksTitle: "📝 So funktioniert's:",
        steps: [
          "Wähle eine Bilddatei aus oder ziehe sie herein",
          "Füge eine Beschreibung hinzu (optional aber empfohlen)",
          "Bestätige und lade hoch",
          "Markiere Familienmitglieder im Foto"
        ]
      },
      
      // Confirm view
      confirm: {
        backButton: "← Zurück",
        cancelButton: "✖ Abbrechen",
        title: "📋 Upload bestätigen",
        previewAlt: "Vorschau",
        fileInfoTitle: "Datei-Informationen",
        filenameLabel: "Dateiname:",
        sizeLabel: "Größe:",
        typeLabel: "Typ:",
        descriptionLabel: "Beschreibung (optional):",
        descriptionPlaceholder: "Gib eine Beschreibung für dieses Bild ein...",
        descriptionHint: "Füge Details hinzu, wann und wo dieses Foto aufgenommen wurde, wer darauf zu sehen ist oder andere relevante Informationen.",
        uploadButton: "Bild hochladen",
        uploadingButton: "⏳ Wird hochgeladen...",
        uploadingMessage: "Bitte warte, während dein Bild hochgeladen wird..."
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
        removeButton: "Entfernen"
      },
      
      // Error messages
      errors: {
        invalidFileType: "Bitte wähle eine gültige Bilddatei (JPEG, PNG, GIF oder WebP)",
        fileSizeExceeded: "Die Dateigröße muss weniger als 10MB betragen",
        uploadFailed: "Fehler beim Hochladen des Bildes: ",
        deleteFailed: "Fehler beim Löschen des Bildes: ",
        tagFailed: "Fehler beim Markieren der Person: ",
        removeFailed: "Fehler beim Entfernen der Person: ",
        loadFailed: "Fehler beim Laden der Bilder:",
        unknownError: "Unbekannter Fehler"
      },
      
      // Success messages
      success: {
        uploadSuccess: "Bild erfolgreich hochgeladen!",
        deleteSuccess: "Bild erfolgreich gelöscht!",
        personRemoved: "Person vom Bild entfernt!"
      },
      
      // Confirmation dialogs
      confirmations: {
        deleteImage: "Bist du sicher, dass du dieses Bild löschen möchtest? Diese Aktion kann nicht rückgängig gemacht werden."
      }
    },
    
    // Node Editor component
    nodeEditor: {
      // Form labels
      labels: {
        name: "Name",
        surname: "Nachname",
        birthDate: "Geburtsdatum",
        deathDate: "Todesdatum",
        street: "Straße",
        city: "Stadt",
        zip: "PLZ",
        country: "Land",
        phone: "Telefon",
        bloodline: "Blutlinie",
        position: "Position",
        positionX: "X:",
        positionY: "Y:"
      },
      
      // Buttons
      buttons: {
        delete: "🗑 Person löschen",
        pictures: "📸 Bilder"
      },
      
      // Messages
      messages: {
        deleteWithConnections: "Diese Person kann nicht gelöscht werden, da sie noch Verbindungen zu anderen Personen hat. Entferne zuerst alle Verbindungen.",
        confirmDelete: "wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden."
      },
      
      // Debug section
      debug: {
        title: "🔧 Debug Informationen",
        bloodlineTrue: "JA",
        bloodlineFalse: "NEIN",
        connectedEdges: "Verbundene Kanten:",
        noConnections: "Keine Verbindungen"
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
      noDescription: "Keine Beschreibung vorhanden"
    },
    
    // Node Editor configuration
    nodeEditor: {
      title: 'Daten ergänzen',
      labels: {
        name: 'Name:',
        surname: 'Nachname:',
        birthDate: 'Geburtsdatum:',
        deathDate: 'Todestag:',
        phone: 'Telefon:',
        street: 'Straße:',
        city: 'Stadt:',
        zip: 'PLZ:',
        country: 'Land (Code):'
      },
      placeholders: {
        phone: 'z.B. +43 5287 87123',
        street: 'z.B. Hauptstraße 123',
        city: 'z.B. Innsbruck',
        zip: '6020',
        country: 'z.B. AT, DE, CH'
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
        delete: '🗑️ Person löschen'
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

    // Map View component
    mapView: {
      title: "🗺️ Wer wohnt wo",
      refreshButton: "",
      loadingLocations: "🔄 Standorte werden geladen...",
      unknownName: "Unbekannt",
      selectedPersonAddress: "📍",
      noAddressAvailable: "Keine Adresse verfügbar",
      showingLocations: "Showing {count} locations from {total} people with addresses",
      noLocationsTitle: "No Locations Found",
      noLocationsMessage: "Add street and city information to people in the editor to see them on the map.",
      mapIcon: "🗺️",
      errors: {
        failedToLoad: "Fehler beim Laden der Standorte",
        googleMapsLoad: "Fehler beim Laden von Google Maps. Bitte überprüfe deinen API-Schlüssel und die Internetverbindung.",
        apiKeyNotConfigured: "Google Maps API key not configured. Please check the setup documentation.",
        setupInstructions: {
          title: "Setup Instructions:",
          step1: "1. Get a Google Maps API key from Google Cloud Console",
          step2: "2. Add it to your .env file as VITE_GOOGLE_MAPS_API_KEY", 
          step3: "3. Enable Maps JavaScript API and Geocoding API",
          seeDocumentation: "See GOOGLE_MAPS_SETUP.md for detailed instructions."
        }
      },
      noLocations: "Keine Standorte gefunden"
    },

    // Default node names for auto-generated nodes
    defaultNames: {
      partner: "Partner",
      child: "Kind", 
      parent: "Eltern",
      family: "Familie" // Template for family nodes (year will be appended)
    }
  }
};
