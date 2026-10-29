/**
 * The grammar of the text format (ADR-0009) in EBNF, as data: docs/language.md shows it,
 * and the ADR copies it. ISO-style EBNF: `{ x }` repetition, `[ x ]` option, `|` choice,
 * `(* … *)` comments. The lexical rules (names, the `*` rule, numbers) come first.
 */
export const GRAMMAR = `(* ---- lexical ---- *)
file          = { line , newline } , [ line ] ;
line          = { space } , [ statement ] , { space } , [ comment ] ;
comment       = "#" , { any character } ;                  (* kept: it belongs to the next statement *)
space         = " " | tab ;                                 (* a trailing CR is dropped *)

pointName     = upper , [ digit , { digit }
                        | "_" , ( digit , { digit } | letter | "{" , alnum , { alnum } , "}" ) ] ,
                { "'" } , { "*" } ;                         (* glued stars always belong to it *)
otherName     = ( lower | greek ) , { letter | digit | "_" | greek } , { "'" } , [ stars ] ;
stars         = "*" , { "*" } ;     (* part of otherName iff the next character is NOT a letter,
                                       digit, "_", "(" or "\\"; a starred name followed by
                                       whitespace and an operand is an error *)
greek         = "α" … "ω" | "Α" … "Ω" | "\\" , greekWord ;  (* \\alpha … \\omega, \\Gamma … \\Omega *)
name          = pointName | otherName ;
number        = digit , { digit } , [ "." , digit , { digit } | "/" , digit , { digit } ] , [ "°" ] ;
                                    (* exact; glued; a leading "-" glued to it makes it negative *)
float         = [ "-" ] , digit , { digit } , [ "." , digit , { digit } ] ,
                [ ( "e" | "E" ) , [ "+" | "-" ] , digit , { digit } ] ;   (* attributes, @viewport *)
string        = '"' , { character | "\\\\" , ( '"' | "\\\\" | "n" | "t" | "r" | "u{" , hex , "}" ) } , '"' ;
symbol escapes: "\\angle" = "∠", "\\measuredangle" = "∡", "\\cdot" = "·", "\\neq" = "\\ne" = "≠";
                "−" = "-", "⋅" = "·", "!=" = "≠", "<=" = "≤", ">=" = "≥".

(* ---- statements: one per line ---- *)
statement     = definition | claimStmt | assumeStmt | triangleStmt | styleStmt | labelStmt
              | directive ;
definition    = name , "=" , expr , { attrGroup } ;        (* keys: style keys, layers *)
claimStmt     = "claim" , claim , { attrGroup } ;           (* key: name *)
assumeStmt    = "assume" , condition ;
triangleStmt  = "triangle" , pointName , pointName , pointName , { attrGroup } ;
                                    (* keys: acute, scalene, obtuse_at_<vertex> *)
styleStmt     = "style" , name , { attrGroup } ;           (* style keys; images too: style A* … *)
labelStmt     = "label" , name , string ;
directive     = "@version" , digit , { digit }
              | "@title" , string | "@author" , string
              | "@layer" , name , [ "=" , "image" , "(" , name , "," , name , ")" ] , { attr }
                                    (* keys: main, visible, locked, opacity, order;
                                       derived: suffix, exclude *)
              | "@view" , name , { attr }                   (* keys: layers, viewport *)
              | "@viewport" , float , float , float ;       (* centre x, centre y, zoom *)

(* ---- attributes ---- *)
attr          = attrGroup | attrItem ;                      (* bare items in directives only *)
attrGroup     = "[" , [ attrItem , { "," , attrItem } ] , "]" ;
attrItem      = key , [ "=" , value , { "," , value } ] ;   (* a list (exclude, layers, viewport)
                                                               takes the rest of its group *)
value         = float | number | name | "-" , name | string | stars ;
style keys    : color=word|string, width=float, dash=solid|dashed|dotted, hidden[=true|false],
                noimage[=true|false], label=string, z=float, label_angle=float (degrees),
                label_dist=float (pixels, >= 0).

(* ---- expressions ---- *)
expr          = product , { ( "+" | "-" ) , product } ;
product       = unary , { ( "*" | "·" | "/" ) , unary } ;
unary         = "-" , number                                (* glued: a negative literal *)
              | "-" , unary | primary ;
primary       = number | name | call | "(" , expr , ")" | "(" , expr , "," , expr , ")" ;
                                                            (* (x, y) is point(x, y) *)
call          = tool , "(" , [ args ] , ")" ;               (* tool: a registry name *)
args          = arg , { "," , arg } , { "," , selector } | selector , { "," , selector } ;
arg           = expr | string ;                             (* on(obj) gets an explicit parameter;
                                                               a string only as a whole argument:
                                                               text(P, "…") (ADR-0011) *)
selector      = ( "same_side" | "opposite_side" ) , "(" , expr , "," , expr , ")"
              | "on_arc" , "(" , expr , "," , expr , "," , [ "not" ] , expr , ")"
              | "between" , "(" , expr , "," , expr , ")"
              | ( "inside" | "outside" ) , "(" , expr , ")"
              | ( "other" | "near" | "far_from" ) , "(" , expr , ")"     (* other(P): one argument *)
              | "other" , "(" , expr , "," , expr , "," , expr , ")"   (* conic ∩ conic, ADR-0043 *)
              | ( "along" | "orient" ) , "(" , ( "+" | "-" ) , ")" ;

(* ---- claims (kinds of ADR-0008) ---- *)
claim         = kind , "(" , expr , { "," , expr } , ")"    (* every kind by name *)
              | segment , "=" , [ number , ( "·" | "*" ) ] , segment          (* length *)
              | segment , "/" , segment , "=" , segment , "/" , segment      (* ratio *)
              | segment , "/" , segment , "=" , number                       (* ratio_value *)
              | [ number , [ "·" | "*" ] ] , dangle , "=" , dangle           (* dangle *)
              | "∡" , "(" , expr , "," , expr , ")" , "=" , number           (* dangle_lines *)
              | angle , "=" , angle                                          (* angle_eq *)
              | angle , ( "+" | "-" ) , angle , "=" , number                 (* angle_sum, angle_diff *)
              | "harmonic" , "(" , expr , "," , expr , ";" , expr , "," , expr , ")"
                                    (* harmonic, or harmonic_lines on four lines (ADR-0040) *)
              | "cross_ratio" , "(" , expr , "," , expr , [ "," | ";" ] , expr , "," , expr , ")" ,
                "=" , number        (* cross_ratio, or cross_ratio_lines on four lines *)
              | expr , "=" , expr ;                                          (* equal *)
segment       = pointName , pointName                       (* glued: AB *)
              | "dist" , "(" , expr , "," , expr , ")" ;
angle         = "∠" , pointName , pointName , pointName     (* glued: ∠ABC, the angle at B *)
              | "∠" , "(" , expr , "," , expr , "," , expr , ")"
              | "angle" , "(" , expr , "," , expr , "," , expr , ")" ;
dangle        = "∡" , pointName , pointName , pointName
              | "∡" , "(" , expr , "," , expr , "," , expr , ")" ;

(* ---- assumptions (open conditions) ---- *)
condition     = kind , "(" , expr , { "," , expr } , ")"
              | measure , ( "<" | ">" | "≠" ) , measure
              | expr , "inside" , expr
              | expr , { "," , expr } , "in" , "order" , "on" , expr ;
measure       = segment | angle | number | expr ;`;
