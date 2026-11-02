var e=`CREATE NODE TYPE ( PersonType : Person {
    name: STRING,
    OPTIONAL nickname: STRING,
    tags: STRING {1,3},
    birthDate: DATE,
    active: BOOL
})
`;export{e as default};