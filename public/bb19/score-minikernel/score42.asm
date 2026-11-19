minikernel
 lda scorepointers+1
 sta temp1

 lda scorepointers+3
 sta temp3


 sta HMCLR
 tsx
 stx stack1 
 ldx #$E0
 stx HMP0

               LDA scorecolor 
                STA COLUP0
                STA COLUP1
 ifconst pfscore
 lda pfscorecolor
 sta COLUPF
 endif
 sta WSYNC
 ldx #0
                STx GRP0
                STx GRP1 ; seems to be needed because of vdel

 lda scorepointers+5
 sta temp5,x
 lda #>scoretable
 sta scorepointers+1
 sta scorepointers+3
 sta scorepointers+5
 sta temp2
                LDY #7
                STA RESP0
                STA RESP1
 sta temp4
 sta temp6
        STY VDELP0


        LDA #$01
        STA NUSIZ0
        STA NUSIZ1
        STA VDELP1
        LDA #$F0
        STA HMP1
 lda  (scorepointers),y
 sta  GRP0
                STA HMOVE ; cycle 73 ?
 jmp beginscore


 if ((<*)>$d4)
 align 256 ; kludge that potentially wastes space!  should be fixed!
 endif

loop2
 lda  (scorepointers),y     ;+5  68  204
 sta  GRP0            ;+3  71  213      D1     --      --     --

 ; cycle 0
 lda #1
 sta NUSIZ1
 sta NUSIZ0
beginscore
 lda  (scorepointers+8),y
 sta  GRP1
 lda  (scorepointers+6),y
 sta  GRP0
 lax  (scorepointers+2),y
 txs
 lax  (scorepointers+4),y

 lda  (scorepointers+$a),y
 stx  GRP1
 tsx
 stx  GRP0
 ldx #4
 stx NUSIZ1
 stx NUSIZ0
 sta  GRP1
 sty  GRP0
 dey
 bpl  loop2

 ldx stack1 
 txs
 ldy temp1
 sty scorepointers+1

                LDA #0   
 sta PF1
               STA GRP0
                STA GRP1
        STA VDELP0
        STA VDELP1;do we need these
        STA NUSIZ0
        STA NUSIZ1

 ldy temp3
 sty scorepointers+3

 ldy temp5
 sty scorepointers+5
 rts
