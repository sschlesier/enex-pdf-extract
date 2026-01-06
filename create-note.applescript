on run argv
  set noteTitle to item 1 of argv
  set filePath to item 2 of argv
  set folderPath to item 3 of argv

  tell application "Notes"
    set targetFolder to account "iCloud"

    if folderPath is not "" then
      set AppleScript's text item delimiters to "/"
      set folderNames to text items of folderPath
      set AppleScript's text item delimiters to ""

      repeat with folderName in folderNames
        if folderName is not "" then
          -- Use direct reference with 'whose' clause to find folder
          try
            set matchingFolders to folders of targetFolder whose name is folderName
            if (count of matchingFolders) > 0 then
              set targetFolder to item 1 of matchingFolders
            else
              -- Folder doesn't exist, create it
              set targetFolder to make new folder at targetFolder with properties {name:folderName}
            end if
          on error errMsg
            -- If lookup fails, try to create the folder
            try
              set targetFolder to make new folder at targetFolder with properties {name:folderName}
            on error createErr
              -- If creation fails (e.g., duplicate), try to find it again
              delay 0.5
              set matchingFolders to folders of targetFolder whose name is folderName
              if (count of matchingFolders) > 0 then
                set targetFolder to item 1 of matchingFolders
              else
                error "Failed to create or find folder: " & folderName & " in path " & folderPath & ". Error: " & createErr
              end if
            end try
          end try
        end if
      end repeat
    end if

    try
      set fileAlias to POSIX file filePath as alias
    on error
      set fileAlias to POSIX file filePath
    end try

    set newNote to make new note at targetFolder with properties {name:noteTitle}
    make new attachment at newNote with data fileAlias
  end tell
end run

