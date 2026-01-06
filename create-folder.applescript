on run argv
  set folderPath to item 1 of argv

  tell application "Notes"
    set currentParent to account "iCloud"

    set AppleScript's text item delimiters to "/"
    set folderNames to text items of folderPath
    set AppleScript's text item delimiters to ""

    repeat with folderName in folderNames
      if folderName is not "" then
        -- Use direct reference with 'whose' clause to find folder
        try
          set matchingFolders to folders of currentParent whose name is folderName
          if (count of matchingFolders) > 0 then
            set targetFolder to item 1 of matchingFolders
          else
            -- Folder doesn't exist, create it
            set targetFolder to make new folder at currentParent with properties {name:folderName}
          end if
        on error errMsg
          -- If lookup fails, try to create the folder
          try
            set targetFolder to make new folder at currentParent with properties {name:folderName}
          on error createErr
            -- If creation fails (e.g., duplicate), try to find it again
            delay 0.5
            set matchingFolders to folders of currentParent whose name is folderName
            if (count of matchingFolders) > 0 then
              set targetFolder to item 1 of matchingFolders
            else
              error "Failed to create or find folder: " & folderName & ". Error: " & createErr
            end if
          end try
        end try

        set currentParent to targetFolder
      end if
    end repeat
  end tell
end run

