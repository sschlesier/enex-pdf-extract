<?xml version="1.0"?>

<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
    <xsl:output omit-xml-declaration="yes" indent="yes"/>

    <xsl:template match="/">
        <pdfs>
            <xsl:for-each select="en-export/note/resource"> 
                <xsl:if test="mime = 'application/pdf'">
                    <pdf>
                        <name>
                            <xsl:value-of select="resource-attributes/file-name" />
                        </name>
                        <data>
                            <xsl:value-of select="data" />
                        </data>
                    </pdf>
                </xsl:if>
            </xsl:for-each>
        </pdfs>
    </xsl:template>
</xsl:stylesheet>
