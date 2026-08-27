!macro customInit
  ReadEnvStr $0 "USERNAME"
  StrCmp $0 "" 0 +2
  StrCpy $0 "there"
!macroend

!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Thank you for downloading, $0!"
  !define MUI_WELCOMEPAGE_TEXT "Welcome to the ${PRODUCT_NAME} Setup Wizard.$\r$\n$\r$\n${PRODUCT_NAME} is your offline competitive intelligence assistant for Call of Duty.$\r$\n$\r$\nClick Next to continue."
  !insertmacro MUI_PAGE_WELCOME
!macroend
