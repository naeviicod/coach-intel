# Personalized Windows Installer Branding

## Goal

Ship a Windows NSIS installer whose black welcome/finish sidebar identifies the
specific release customer: Coach Intel, Vantix Esports, and Vantix Rome.

## Chosen Design

The 164 x 314 NSIS sidebar will contain three vertically balanced marks on the
existing near-black background:

1. the Coach Intel app mark at the top;
2. the Vantix organization logo in the middle; and
3. the Rome team logo at the bottom.

No runtime lookup is involved. An installer begins before Coach Intel has an
application-data profile, so it cannot safely find an organization or team
logo on the destination PC.

## Release Assets and Build Flow

The Vantix and Rome source images will be copied into an explicit,
version-controlled installer-brand asset directory. A cross-platform Node
generator will validate the expected assets, compose the sidebar bitmap, and
write `build/installerSidebar.bmp` in the format NSIS consumes. The Windows
packaging command will run that generator before `electron-builder`.

The generator will retain the Coach Intel mark and fixed canvas dimensions,
preserve each supplied logo's aspect ratio, and composite opaque black behind
transparent areas so the final BMP is valid for NSIS. Missing, unreadable, or
incorrectly sized output will cause packaging to fail rather than silently
shipping the generic sidebar.

## Scope

- Add only the release-specific Vantix and Rome assets needed for the sidebar.
- Generate and commit the resulting NSIS bitmap for transparent review.
- Update the Windows packaging command, installer documentation/changelog, and
  version-consistency coverage for the next patch release.
- Preserve all unrelated working-tree changes.

## Verification

Verification will run the generator from a clean input, inspect the bitmap
format and dimensions, run the version check and test suite, and build the
Windows NSIS artifact before the release commit and push.
