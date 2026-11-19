minikernel
 lda scorepointers+1
 sta temp1

 lda scorepointers+3
 sta temp3


 sta HMCLR
 tsx
 stx stack1 
 ldx #$A0
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
 sta temp4
 sta temp6
                LDY #7
        STY VDELP0


        LDA #$03
        STA NUSIZ0
        STA NUSIZ1
        STA VDELP1
        LDA #$B0
        STA HMP1
 lda  (scorepointers+4),y
 sta  GRP0
                STA RESP0
                STA RESP1
                STA HMOVE ; cycle 73 ?
 sleep 40
 jmp beginscore


 if ((<*)>$d4)
 align 256 ; kludge that potentially wastes space!  should be fixed!
 endif

loop2
 lda  (scorepointers+4),y
 sta  GRP0
;sleep 7
beginscore
 lda  (scorepointers+$2),y
 sta  GRP1
 lda  (scorepointers+$a),y
 sta  GRP0
 lax  (scorepointers+8),y
 txs
 lax  (scorepointers),y
; sleep 9
 stx  GRP1

 lda  (scorepointers+6),y
 sleep 9
 sleep 7
 tsx
 stx  GRP0
 sta  GRP1
 sty  GRP0
 dey
 bpl  loop2           ;+2  60  180

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
