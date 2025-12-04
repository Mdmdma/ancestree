// English translations
export const en = {
  // Language metadata
  _meta: {
    code: 'en',
    name: 'English',
    flag: '🇬🇧'
  },

  // Header text configuration
  header: {
    title: "Family Tree",
    familyPrefix: "Family",
    subtitle: "Connections Across Generations",
    description: "Help us complete our family tree",
    logoutButton: "Logout"
  },
  
  // UI text configuration
  ui: {
    // Loading states
    loading: {
      familyTree: "Loading family tree..."
    },

    // Collaboration
    collaboration: {
      usersCollaborating: "🤝 {count} online",
      userOnline: "👤 {count} family members online"
    },

    // Tab labels
    tabs: {
      editor: "👤 Editor",
      photos: "📸 Photos",
      map: "🗺️ Map"
    },

    // Editor section text
    editor: {
      selectPersonTitle: "Select a Person",
      selectPersonDescription: "Click on any person to edit their information.",
      addPersonDescription: "Drag from a colored handle to empty space to add a new person.",
      
      // Button labels
      buttons: {
        autoLayout: "🔄 Auto Layout",
        fitToView: "🔍 Fit to View",
      },

      // Keyboard shortcuts help text
      shortcutsHelp: {
        autoLayout: "Auto Layout: Ctrl+L (Cmd+L)",
        fitToView: "Fit to View: Ctrl+F (Cmd+F)",
        debugMode: "Debug Mode: Ctrl+Shift+D (Cmd+Shift+D)"
      },

      // Connection rules
      connectionRules: {
        title: "Connection Rules:",
        parent: "🔴 Red (top): Add parents",
        child: "🟠 Orange (bottom): Add children",
        partner: "🔵 Blue (left/right): Add partner"
      },

      // Validation messages
      validationMessages: {
        familyToFamily: "Direct connections between family nodes are not allowed. Connect people to families instead.",
        directParentChild: "Direct parent-child connections between people are not allowed. Use family nodes to represent generations.",
        partnerNodePartnerHandle: "{name} is a partner node and cannot make additional partner connections. Only bloodline nodes can have multiple partners.",
        partnerNodeMultiplePartners: "{name} is already connected to a bloodline partner. Partner nodes can only have one partner.",
        bloodlineToBloodlinePartner: "For automatic layout to work, bloodline nodes cannot be connected to each other. If necessary, add the corresponding person again as a partner.",
        partnerNodeParentHandle: "{name} is a partner node and cannot use the parent handle. Partner nodes can only form families through child handles.",
        bloodlineMultipleParents: "{name} already has {count} parent connection(s). Bloodline nodes can only have one parent family."
      },

      // Debug information
      debug: {
        title: "🔧 ELK Debug Information",
        overview: "Overview:",
        totalNodes: "Total Nodes:",
        bloodlineNodes: "Bloodline Nodes (in ELK):",
        partnerOnlyNodes: "Partner-Only Nodes:",
        bloodlineEdges: "Bloodline Edges (for layout):",
        fakeEdges: "Fake Bloodline Edges (ignored):",
        partnerEdges: "Partner Edges:",
        partnerCounts: "Partner Counts:",
        partners: "Partner",
        partnersPlural: "Partners",
        elkNodeDimensions: "ELK Node Dimensions:",
        nodeLabel: "Node",
        width: "Width:",
        height: "Height:",
        partnersLabel: "Partners:",
        birth: "Birth:",
        notSet: "Not set"
      }
    },
    
    // Image tagging mode
    imageTagging: {
      activeMessage: "🏷️ Image tagging mode active - Click on a person to tag them automatically"
    },
    
    // Image Gallery component
    imageGallery: {
      title: "📸 Family Photos",
      
      // Gallery view
      gallery: {
        uploadButton: "📤 Upload Image",
        refreshButton: "🔄 Refresh",
        noImagesTitle: "No images uploaded yet.",
        noImagesDescription: "Click \"Upload Image\" to add your first family photo!",
        noDescription: "No description",
        personTagged: "person tagged",
        personsTagged: "persons tagged"
      },
      
      // Upload view
      upload: {
        backButton: "← Back to Gallery",
        dragDropTitle: "Drag & Drop or Click to Upload",
        supportedFormats: "Supported formats: JPEG, PNG, GIF, WebP (Max 10MB)",
        selectFileButton: "📁 Select File",
        dropHereMessage: "",
        howItWorksTitle: "📝 How it works:",
        steps: [
          "Select or drag an image file",
          "Add a description (optional but recommended)",
          "Confirm and upload",
          "Tag family members in the photo"
        ]
      },
      
      // Confirm view
      confirm: {
        backButton: "← Back",
        cancelButton: "✖ Cancel",
        title: "📋 Confirm Upload",
        previewAlt: "Preview",
        fileInfoTitle: "File Information",
        filenameLabel: "Filename:",
        sizeLabel: "Size:",
        typeLabel: "Type:",
        descriptionLabel: "Description (optional):",
        descriptionPlaceholder: "Enter a description for this image...",
        descriptionHint: "Add details about when and where this photo was taken, who is in it, or other relevant information.",
        uploadButton: "Upload Image",
        uploadingButton: "⏳ Uploading...",
        uploadingMessage: "Please wait while your image is being uploaded..."
      },
      
      // View image
      view: {
        backButton: "← Back to Gallery",
        tagPeopleButton: "🏷 Tag People",
        cancelTaggingButton: "✖ Cancel Tagging",
        deleteButton: "🗑 Delete Image",
        descriptionTitle: "Description",
        taggedPeopleTitle: "Tagged People",
        noTaggedPeople: "No people tagged in this image yet.",
        tagPeoplePrompt: "Click \"Tag People\" to tag family members!",
        removeButton: "Remove",
        loadingImage: "Loading image..."
      },
      
      // Error messages
      errors: {
        invalidFileType: "Please select a valid image file (JPEG, PNG, GIF, or WebP)",
        fileSizeExceeded: "File size must be less than 10MB",
        uploadFailed: "Failed to upload image: ",
        deleteFailed: "Failed to delete image: ",
        tagFailed: "Failed to tag person: ",
        removeFailed: "Failed to remove person: ",
        loadFailed: "Failed to load images:",
        unknownError: "Unknown error"
      },
      
      // Success messages
      success: {
        uploadSuccess: "Image uploaded successfully!",
        deleteSuccess: "Image deleted successfully!",
        personRemoved: "Person removed from image!"
      },
      
      // Confirmation dialogs
      confirmations: {
        deleteImage: "Are you sure you want to delete this image? This action cannot be undone."
      }
    },
    
    // Person Picture Slideshow component
    slideshow: {
      loadingTitle: "Loading images...",
      loadingMessage: "Loading images...",
      errorTitle: "Error",
      errorMessage: "Error loading images: ",
      noPicturesIcon: "📷",
      noPicturesMessage: "No images found for ",
      picturesTitle: "Pictures of ",
      descriptionTitle: "Description",
      taggedPeopleTitle: "Tagged People",
      taggedMessage: "This person is tagged in this image",
      editButton: "✏️ Edit",
      saveButton: "💾 Save",
      cancelButton: "✖ Cancel",
      descriptionPlaceholder: "Enter description...",
      noDescription: "No description available",
      fullscreenButton: "⛶ Fullscreen",
      exitFullscreenButton: "⛶ Exit Fullscreen",
      previousButton: "‹",
      nextButton: "›",
      questionButton: "? Mark images with open questions ?"
    },
    
    // Node Editor configuration
    nodeEditor: {
      title: 'Add Information',
      missingTaggedImage: 'This person needs to be tagged in at least one image',
      labels: {
        name: 'First Name:',
        surname: 'Last Name:',
        maidenName: 'Maiden Name:',
        birthDate: 'Birth Date:',
        deathDate: 'Death Date:',
        phone: 'Phone:',
        email: 'Email:',
        street: 'Street:',
        housenumber: 'No:',
        city: 'City:',
        zip: 'ZIP:',
        country: 'Country:',
        addressAutocomplete: 'Address Search'
      },
      placeholders: {
        phone: 'e.g. +1 555 123-4567',
        email: 'e.g. name@example.com',
        maidenName: 'e.g. Smith (if different)',
        street: 'e.g. Main Street',
        housenumber: 'e.g. 42',
        city: 'e.g. New York',
        zip: '10001',
        country: 'e.g. US, UK, CA',
        addressAutocomplete: 'Enter full address: Street, City, Country...'
      },
      validation: {
        phoneFormat: 'Phone number must start with + and contain only digits',
        emailFormat: 'Please enter a valid email address'
      },
      debug: {
        title: '🔧 Debug Fields',
        nodeId: 'Node ID (Read-only):',
        bloodlineStatus: 'Bloodline Status:',
        bloodlineOnStatus: 'On bloodline',
        bloodlineOffStatus: 'Partner only',
        xPosition: 'X Position:',
        yPosition: 'Y Position:',
        connections: 'Connections',
        totalConnections: 'Total Connections:'
      },
      buttons: {
        pictures: '📷 Pictures',
        delete: '🗑️ Delete Person',
        deleteFamily: '🗑️ Delete Family'
      },
      messages: {
        deleteWithConnections: 'This person cannot be deleted because they still have connections to other people. Remove all connections first.',
        confirmDelete: 'really delete? This action cannot be undone.',
        confirmDeletePrefix: 'Do you want to delete "',
        confirmDeleteSuffix: '" '
      }
    },
    
    // Common UI elements
    common: {
      loading: "Loading...",
      error: "Error",
      cancel: "Cancel",
      confirm: "Confirm",
      save: "Save",
      delete: "Delete",
      edit: "Edit",
      back: "Back",
      next: "Next",
      previous: "Previous",
      close: "Close"
    },

    // Contact information
    contact: {
      buttonText: "📧 Contact",
      dialogTitle: "Contact the Developer",
      description: "Hi! I'm Mathis, the developer of AncesTree. If you have questions, suggestions, or technical issues, feel free to contact me. I'm happy to help!",
      emailButtonText: "📧 Send Email",
      emailAddress: "m.erler@gmx.ch",
      githubButtonText: "💻 GitHub",
      githubUrl: "https://github.com/Mdmdma/ancestree",
      closeButton: "Close"
    },

    // Admin Panel texts
    adminPanel: {
      title: "Admin Panel",
      authPrompt: "Enter the admin password to access settings.",
      defaultAdminNote: "Default password: adminn",
      contactAdmin: {
        message: "Contact the creator of your family tree:",
        noEmailSet: "No email address set"
      },
      contactFamily: {
        message: "Contact all family members in the tree:",
        button: "Contact the whole family",
        subject: "Family tree inquiries",
        noEmailsFound: "No email addresses found in the tree"
      },
      menu: {
        familyParameters: "Family Parameters",
        passwords: "Passwords",
        security: "Security",
        visibleFields: "Visible Fields",
        completion: "Completion",
        dataExport: "Export Data",
        dangerZone: "⚠️ Danger Zone"
      },
      familyParameters: {
        title: "Family Parameters",
        displayNameLabel: "Display Name",
        adminEmailLabel: "Admin Email",
        adminEmailHint: "Used for account inquiries and important notifications",
        purposeLabel: "Purpose",
        purposePlaceholder: "Describe the purpose of this family tree...",
        saveButton: "Save"
      },
      passwords: {
        title: "Passwords",
        familyPasswordLabel: "Family Password",
        adminPasswordLabel: "Admin Password",
        newPasswordLabel: "New Password",
        confirmPasswordLabel: "Confirm Password",
        currentFamilyPasswordPlaceholder: "Current Family Password",
        newFamilyPasswordPlaceholder: "New Family Password",
        confirmFamilyPasswordPlaceholder: "Confirm Family Password",
        newAdminPasswordPlaceholder: "New Admin Password",
        confirmAdminPasswordPlaceholder: "Confirm Admin Password",
        saveButton: "Update Password"
      },
      security: {
        title: "Security",
        encryptionLabel: "Enable client-side encryption",
        encryptionHint: "When enabled, all stored data is encrypted client-side using the family password.",
        nodeCreationLockLabel: "Lock node creation",
        nodeCreationLockHint: "When enabled, users cannot create new nodes in the family tree"
      },
      visibleFields: {
        title: "Visible Fields",
        description: "Control which fields are shown in the data editor.",
        streetFieldsLabel: "Show street and house number",
        streetFieldsHint: "When enabled, street and house number fields are shown in the editor.",
        phoneFieldLabel: "Show phone number",
        phoneFieldHint: "When enabled, the phone number field is shown in the editor.",
        emailFieldLabel: "Show email address",
        emailFieldHint: "When enabled, the email address field is shown in the editor.",
        showSuccess: "Street fields are now visible",
        hideSuccess: "Street fields are now hidden",
        phoneShowSuccess: "Phone field is now visible",
        phoneHideSuccess: "Phone field is now hidden",
        emailShowSuccess: "Email field is now visible",
        emailHideSuccess: "Email field is now hidden",
        updateError: "Error updating field visibility"
      },
      completion: {
        title: "✅ Track Completion",
        description: "Track which person nodes have incomplete required fields. When enabled, nodes with missing required information will be highlighted with a red border and complete nodes with a green border.",
        mainToggleLabel: "Show incomplete nodes",
        mainToggleHint: "When enabled, person nodes with missing required fields show a red border and complete nodes show a green border",
        requiredFieldsTitle: "Required Fields",
        requiredFieldsDescription: "Select which fields are required for a node to be considered complete. Incomplete required fields will be highlighted in red in the node editor.",
        fields: {
          name: {
            label: "First Name",
            hint: "First name is required"
          },
          surname: {
            label: "Last Name",
            hint: "Family name is required"
          },
          maidenName: {
            label: "Maiden Name",
            hint: "Maiden name is required (if applicable)"
          },
          birthDate: {
            label: "Birth Date",
            hint: "Birth date is required"
          },
          streetFields: {
            label: "Street & House Number",
            hint: "Street address is required"
          },
          cityZip: {
            label: "City & ZIP Code",
            hint: "City and ZIP code are required"
          },
          country: {
            label: "Country",
            hint: "Country is required"
          },
          phone: {
            label: "Phone",
            hint: "Phone number is required"
          },
          email: {
            label: "Email",
            hint: "Email address is required"
          },
          taggedImage: {
            label: "📷 Tagged Image",
            hint: "Person must be tagged in at least one image"
          }
        },
        success: "Completion settings updated",
        updateError: "Error updating setting",
        settingsUpdateError: "Error updating completion settings"
      },
      errors: {
        passwordsDoNotMatch: "Passwords do not match",
        passwordTooShort: "Password must be at least 6 characters",
        currentPasswordRequired: "Current family password is required to re-encrypt data",
        testFailed: "Test failed: "
      },
      success: {
        familyPasswordUpdated: "Family password updated successfully!",
        adminPasswordUpdated: "Admin password updated successfully!",
        settingsUpdated: "Settings updated successfully!",
        encryptionEnabled: "Encryption enabled successfully!",
        encryptionDisabled: "Encryption disabled successfully!"
      },
      encryption: {
        confirmEnable: "Do you really want to enable encryption? This will re-encrypt all data.",
        confirmDisable: "Do you really want to disable encryption? This will decrypt all data.",
        enterPassword: "Enter family password:",
        enterPasswordPlaceholder: "Enter family password",
        confirmButton: "Confirm",
        cancelButton: "Cancel",
        progress: {
          encrypting: "Encrypting data...",
          decrypting: "Decrypting data...",
          complete: "Complete!"
        }
      },
      dataExport: {
        title: "Export Data",
        description: "Download all family data and images as a ZIP file.",
        downloadButton: "📥 Download Data",
        downloadingButton: "⏳ Downloading...",
        progress: {
          loadingNodes: "Loading person data...",
          loadingImages: "Loading image metadata...",
          generatingCSV: "Generating CSV file...",
          downloadingImages: "Downloading images ({current}/{total})...",
          creatingZip: "Creating ZIP archive...",
          complete: "Download complete!"
        },
        whatWillBeExported: "What will be exported:",
        exportItems: {
          personalData: "All person data (decrypted) as CSV",
          images: "All family images",
          imageMetadata: "Image metadata (descriptions and tagged people) as text files"
        },
        hints: {
          decrypted: "💡 Note: All exported data is decrypted and readable.",
          keepSafe: "🔒 Keep the downloaded file safe."
        },
        errors: {
          noNodes: "No person data found to export.",
          downloadFailed: "Error downloading data: "
        }
      },
      dangerZone: {
        title: "⚠️ Danger Zone",
        description: "Actions in this area are irreversible and will permanently delete all family data.",
        deleteDatabase: {
          title: "Delete Family Database",
          description: "This will permanently delete:",
          items: {
            treeData: "All family tree data (people, relationships)",
            images: "All images and media",
            locations: "All location data",
            databaseFile: "The family database file",
            authEntry: "Your family account from the authentication database"
          },
          deleteButton: "Delete Family Database",
          finalWarning: {
            title: "⚠️ FINAL WARNING",
            message: "This action cannot be undone. All data will be permanently lost."
          },
          confirmLabel: "Type <strong>DELETE</strong> to confirm:",
          confirmPlaceholder: "DELETE",
          adminPasswordLabel: "Enter admin password:",
          adminPasswordPlaceholder: "Admin password",
          deleteButtonFinal: "🗑️ Permanently Delete",
          deleting: "Deleting...",
          cancelButton: "Cancel"
        }
      }
    },

    // Admin panel small labels and actions
    adminPanelCommon: {
      authenticateButton: 'Authenticate',
      authenticating: 'Authenticating...',
      updateButton: 'Update',
      saveButton: 'Save',
      cancelButton: 'Cancel',
      closeButton: '×',
      currentFamilyPasswordLabel: 'Current family password (required for re-encryption):',
      noDescription: 'No description set.'
    },

    // Login component
    login: {
      welcome: {
        titleRegister: 'Set Up Your Family Tree',
        titleLogin: 'Welcome to AncesTree',
        setupDescription: 'Create secure credentials for your family',
        registerDescription: 'Set up a new family tree',
        loginDescription: 'Sign in to access your family tree'
      },
      form: {
        familyNameLabel: 'Family Name:',
        familyIdLabel: 'Unique Family Identifier:',
        familyNamePlaceholder: 'Enter your family name',
        familyIdPlaceholder: 'e.g. smith-family-2024',
        familyIdHint: 'Used for login (cannot be changed later)',
        displayNameLabel: 'Display Name:',
        displayNamePlaceholder: 'e.g. The Smith Family',
        displayNameHint: 'Shown in the app (can be changed later)',
        adminEmailLabel: 'Admin Email:',
        adminEmailPlaceholder: 'admin@example.com',
        adminEmailHint: 'Used for account inquiries and important notifications',
        betaAccessPasswordLabel: 'Beta Access Code:',
        betaAccessPasswordPlaceholder: 'Enter the beta access code',
        betaAccessPasswordHint: 'Contact me to get the beta access code',
        passwordLabel: 'Password:',
        createPasswordLabel: 'Create Password:',
        passwordPlaceholder: 'Enter your password',
        createPasswordPlaceholder: 'Create a secure password',
        adminPasswordLabel: 'Admin Password:',
        adminPasswordPlaceholder: 'Create admin password (min. 6 characters)',
        adminPasswordHint: 'Required for admin panel and settings access'
      },
      buttons: {
        register: 'Create Family Access',
        login: 'Access Family Tree',
        pleaseWait: 'Please wait...',
        switchToLogin: 'Already have access? Sign in',
        switchToRegister: 'First time? Set up family access'
      },
      security: {
        privateNotice: '🔒 Your family tree is private and secure',
        authorizedOnly: 'Only authorized family members have access'
      },
      terms: {
        checkboxText: 'I accept the',
        termsLink: 'Terms of Service and Privacy Policy',
        ageConfirmation: 'and confirm that I am at least 16 years old.',
        loginNotice: 'By signing in, you accept the',
        termsRequired: 'You must accept the terms and conditions'
      },
      validation: {
        invalidEmail: 'Please enter a valid email address',
        emailRequired: 'Admin email is required'
      }
    },

    // Map View component
    mapView: {
      title: "🗺️ Who Lives Where",
      refreshButton: "",
      loadingLocations: "🔄 Loading locations...",
      unknownName: "Unknown",
      selectedPersonAddress: "📍",
      noAddressAvailable: "No address available",
      noLocationsTitle: "No locations found",
      noLocationsMessage: "Add city and country information to people in the editor to see them on the map.",
      mapIcon: "🗺️",
      fullscreenEnter: "Enter Fullscreen",
      fullscreenExit: "Exit Fullscreen",
      errors: {
        failedToLoad: "Failed to load locations"
      },
      noLocations: "No locations found"
    },

    // Default node names for auto-generated nodes
    defaultNames: {
      partner: "Partner",
      child: "Child", 
      parent: "Parents",
      family: "Family"
    },

    // Node Search component
    nodeSearch: {
      placeholder: "Search people...",
      navigatingPlaceholder: "Navigating to person...",
      searchingMessage: "Searching...",
      noResultsMessage: "No people found for \"{searchTerm}\"",
      resultCountSingle: "{count} person found",
      resultCountMultiple: "{count} people found",
      resultCountLimited: "Showing 8 of {total} people found",
      unnamedPerson: "Unnamed Person",
      bornLabel: "Born:"
    },

    // Family Gallery Slideshow component
    familyGallery: {
      title: "Photo Album",
      loadingTitle: "Loading family images...",
      loadingMessage: "Loading family images...",
      errorTitle: "Error",
      errorMessage: "Error loading family images: ",
      noPicturesIcon: "📷",
      noPicturesTitle: "No family images found",
      noPicturesMessage: "No images have been added to the family gallery yet.",
      descriptionTitle: "Description",
      taggedPeopleTitle: "Tagged People",
      noTaggedPeople: "No people tagged in this image.",
      editButton: "✏️ Edit",
      saveButton: "💾 Save",
      cancelButton: "✖ Cancel",
      descriptionPlaceholder: "Enter description...",
      noDescription: "No description available",
      galleryButton: "🖼️ Family Album",
      fullscreenButton: "⛶ Fullscreen",
      exitFullscreenButton: "⛶ Exit Fullscreen",
      previousButton: "‹",
      nextButton: "›",
      questionButton: "? Mark images with open questions ?"
    },

    // Alerts and notifications
    alerts: {
      nodeCreationLocked: {
        title: "⚠️ Node Creation Locked",
        message: "Node creation is currently disabled by the administrator. Please contact the administrator to unlock node creation."
      },
      lastBloodlineNodeDelete: {
        title: "⚠️ Cannot Delete",
        message: "The last bloodline person cannot be deleted. There must be at least one person in the bloodline."
      }
    },

    // Chat component for image discussions
    chat: {
      title: "💬 Discussion",
      noMessages: "No messages yet. Start the discussion about this image!",
      namePlaceholder: "Your name...",
      messagePlaceholder: "Write a comment about this image... (Ctrl+Enter to send)",
      sendButton: "Send",
      sendingButton: "Sending...",
      deleteButton: "Delete",
      nameRequired: "Please enter your name",
      messageRequired: "Please write a message",
      messageTooLong: "Message must be 300 characters or less",
      loadingMessages: "Loading messages...",
      errorLoading: "Error loading messages",
      errorSending: "Error sending message",
      errorDeleting: "Error deleting message",
      deleteConfirm: "Are you sure you want to delete this message?",
      timeFormat: {
        justNow: "just now",
        minutesAgo: "{minutes} min ago",
        hoursAgo: "{hours} hours ago", 
        daysAgo: "{days} days ago",
        dateFormat: "MM/DD/YYYY HH:mm"
      }
    },

    // Language picker
    languagePicker: {
      label: "Language",
      selectLanguage: "Select language"
    },

    // Terms Acceptance Dialog
    termsAcceptance: {
      title: "New Terms and Conditions",
      updateRequired: "Update Required",
      updateRequiredMessage: "There are updated terms and conditions (Version {version}) that you must accept to continue using the service.",
      currentAcceptedVersion: "Your currently accepted version: {version}",
      accountOwnerNotice: "As account owner, you are responsible for informing all people who have access to your family account about the updated terms.",
      readFullTerms: "Read full Terms and Conditions and Privacy Policy",
      versionInfo: "Version {version} | Last updated: {date}",
      adminPasswordLabel: "Admin Password to Confirm",
      adminPasswordPlaceholder: "Enter admin password",
      adminPasswordHint: "Admin password is required to accept the new terms on behalf of all family members.",
      deadlineWarning: "If you do not accept the new terms within one month of their publication, your account and all associated data will be deleted.",
      laterButton: "Later",
      acceptButton: "Accept Terms and Conditions",
      acceptingButton: "Accepting...",
      errors: {
        adminPasswordRequired: "Please enter the admin password",
        acceptFailed: "Failed to accept terms and conditions"
      }
    },

    // Terms and Conditions modal
    termsAndConditions: {
      title: "Terms of Service and Privacy Policy",
      closeButton: "Close"
    }
  }
};

export default en;
